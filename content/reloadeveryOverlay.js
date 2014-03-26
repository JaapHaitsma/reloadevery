/* -*- Mode: js; indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*- */

/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Initial Developer of the Original Code is Jaap Haitsma.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * by the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Jaap Haitsma <jaap@haitsma.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

if(!org) var org={};
if(!org.mozdev) org.mozdev={};
if(!org.mozdev.reloadevery) org.mozdev.reloadevery={};

org.mozdev.reloadevery = {
    DEBUG: false,

    APP_NAME: "ReloadEvery",
    VERSION: "26.0.0",

    DEFAULT_RELOAD_TIME: 10,
    DEFAULT_RELOAD_NEW_TABS: false,
    DEFAULT_CUSTOM_RELOAD_TIME: 90,
    DEFAULT_RANDOMIZE: false,
    prefs: null,
    tabID: 0,
    dialogAccepted: false,

    dumpObject: function(obj) {
        for(var i in obj){         
            this.debug(i + " = " + obj[i] + "\n");
        }

    },

    debug: function(str) {
        var console = Components.utils.import("resource://gre/modules/devtools/Console.jsm", {}).console;
        console.log(this.APP_NAME + ": " + str);
        if (!this.DEBUG) {
            return;
        }
    
    },

    tabAdded: function(event) {
        var newTab = gBrowser.getBrowserForTab(event.target);
        if (newTab.reloadEveryEnabled == null) {
            this.debug("tabAdded() new tab"); 
            this.setupTab(newTab); 
        }
    },

    init: function (){
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"].
                        getService(Components.interfaces.nsIPrefService).getBranch("reloadevery.");

        try {
            this.DEBUG = this.prefs.getBoolPref("debug");
        } catch (e if e.name = "NS_ERROR_UNEXPECTED") {
            this.DEBUG = false;
            this.debug("init(): no preferences found in prefs.js taking default for debug");
            this.prefs.setBoolPref("debug", this.DEBUG);
        }
        this.debug("init()");

        try {
            this.prefs.getIntPref("reload_time");
        } catch (e if e.name = "NS_ERROR_UNEXPECTED") {
            this.debug("init(): no preferences found in prefs.js taking default for reload_time");
            this.prefs.setIntPref("reload_time", this.DEFAULT_RELOAD_TIME);
        }

        try {
            this.prefs.getBoolPref("reload_new_tabs");
        } catch (e if e.name = "NS_ERROR_UNEXPECTED") {
            this.debug("init(): no preferences found in prefs.js taking default for reload_new_tabs");
            this.prefs.setBoolPref("reload_new_tabs", this.DEFAULT_RELOAD_NEW_TABS);
        }
        if (this.prefs.getBoolPref("reload_new_tabs")) {
            this.setupTab(this.getCurTab());
        }
        try {
            this.prefs.getIntPref("custom_reload_time");
        } catch (e if e.name = "NS_ERROR_UNEXPECTED") {
            this.debug("init(): no preferences found in prefs.js taking default for custom_reload_time");
            // Assign default value
            this.prefs.setIntPref("custom_reload_time", this.DEFAULT_CUSTOM_RELOAD_TIME);
        }

        try {
            this.prefs.getBoolPref("randomize");
        } catch (e if e.name = "NS_ERROR_UNEXPECTED") {
            this.debug("init(): no preferences found in prefs.js taking default for reload time randomization");
            this.prefs.setBoolPref("randomize", this.DEFAULT_RANDOMIZE);
        }
    
        if (!this.prefs.prefHasUserValue("version")) {
            this.debug("init(): no version found");
            setTimeout(function() { window.openUILinkIn("http://reloadevery.mozdev.org/thanks.html", "tab"); }, 500);
            this.prefs.setCharPref("version", this.VERSION);
        }
        if (this.prefs.getCharPref("version") != this.VERSION) {
            this.debug("init(): newer version");
            setTimeout(function() { window.openUILinkIn("http://reloadevery.mozdev.org/thanks.html", "tab"); }, 500);
            this.prefs.setCharPref("version", this.VERSION);
        }

        try{
            document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", function () {org.mozdev.reloadevery.contextPopup()}, false);
            document.getElementById("tabContextMenu").addEventListener("popupshowing", function () {org.mozdev.reloadevery.tabPopup()}, false);
            gURLBar.addEventListener("keypress", function () {org.mozdev.reloadevery.onKeyPressInURLBar()}, false);
            gBrowser.tabContainer.addEventListener("TabOpen", function (event) {org.mozdev.reloadevery.tabAdded(event)}, false);
        }
        catch(e){
            this.debug("gURLBar.addEventListener failed");
            // Do nothing. reloadEveryInit() is also called when the preferences dialog is called and there 
            // gURLBar.addEventListener("keypress", function () {org.mozdev.reloadevery.onKeyPressInURLBar()}, false);  
            // fails
        }
    },

    getCurTab: function(){
        return getBrowser().mCurrentBrowser;
    },


    setupTab: function(tab){
        this.debug("setupTab(tab)");
        // Add member attributes
        tab.reloadEveryEnabled = false;
        tab.reloadEveryReloadTime = this.prefs.getIntPref("reload_time");
        this.debug("reload time: " + tab.reloadEveryReloadTime);
        tab.reloadEveryTimerID = null;
        tab.postDataAcceptedByUser = false;
        tab.randomize = this.prefs.getBoolPref("randomize");
        tab.id = "ActiveReloadTab" + this.tabID;     
        this.tabID++;    
        this.debug("setupTab(tab)" + tab.id);

        if (this.prefs.getBoolPref("reload_new_tabs")) {
            this.enable(tab);
        }

        tab.reloadEveryProgressListener = this.progressListener(tab);

    },

    // hide the Reload Every item when apropriate (use same logic as for Back, Stop etc.)
    showPopupMenu: function(prefix) {

        // Check if this a new window/tab   
        if (this.getCurTab().reloadEveryEnabled == null) {
            this.debug("popup() new window"); 
            this.setupTab(this.getCurTab());    
        }

        if (this.getCurTab().reloadEveryEnabled){
            document.getElementById(prefix + "_enable").setAttribute("checked", "true");
        }
        else {
            document.getElementById(prefix + "_enable").setAttribute("checked", "false");
        }

        if (this.getCurTab().randomize){
            document.getElementById(prefix + "_randomize").setAttribute("checked", "true");
        }
        else {
            document.getElementById(prefix + "_randomize").setAttribute("checked", "false");
        }

 
        // First uncheck all radio menuitems
        document.getElementById(prefix + "_5s").setAttribute("checked", "false");
        document.getElementById(prefix + "_10s").setAttribute("checked", "false");
        document.getElementById(prefix + "_30s").setAttribute("checked", "false");
        document.getElementById(prefix + "_1m").setAttribute("checked", "false");
        document.getElementById(prefix + "_5m").setAttribute("checked", "false");
        document.getElementById(prefix + "_15m").setAttribute("checked", "false");
        document.getElementById(prefix + "_custom").setAttribute("checked", "false");

        // Now select the appropriate one
 
        if (this.getCurTab().reloadEveryReloadTime == 5) {
            document.getElementById(prefix + "_5s").setAttribute("checked", "true");
        }
        else if (this.getCurTab().reloadEveryReloadTime == 10) {
            document.getElementById(prefix + "_10s").setAttribute("checked", "true");
        }
        else if (this.getCurTab().reloadEveryReloadTime == 30) {
            document.getElementById(prefix + "_30s").setAttribute("checked", "true");
        }
        else if (this.getCurTab().reloadEveryReloadTime == 60) {
            document.getElementById(prefix + "_1m").setAttribute("checked", "true");  
        }
        else if (this.getCurTab().reloadEveryReloadTime == 5*60) {
            document.getElementById(prefix + "_5m").setAttribute("checked", "true");
        }
        else if (this.getCurTab().reloadEveryReloadTime == 15*60) {
            document.getElementById(prefix + "_15m").setAttribute("checked", "true");
        }
        else if (this.getCurTab().reloadEveryReloadTime >= 0) {
            document.getElementById(prefix + "_custom").setAttribute("checked", "true"); 
        }
        else {
            alert ("Invalid reload time:" + this.getCurTab().reloadEveryReloadTime + "s");
        }
    },
    
    contextPopup: function() {
        this.debug("popup()");
        var cm = gContextMenu;
        // hide the Reload Every item when apropriate (use same logic as for Back, Stop etc.)
        var hidden = cm.isTextSelected || cm.onLink || cm.onImage || cm.onTextInput;
        document.getElementById("reloadevery_menu").hidden = hidden;
        if (!hidden) {
            this.showPopupMenu("reloadevery");
        }
    },

    tabPopup: function() {
        this.debug("tabPopup()");
        this.showPopupMenu("tab_reloadevery");
    },

    // Reloads the page of the tab with the specified reloadEveryTabID 
    reloadPage: function (reloadEveryTabID){
        this.debug("reloadPage(...) : " + reloadEveryTabID);
        var tab = document.getElementById(reloadEveryTabID); 

        if (tab == null){
            this.debug("reloadPage(...) : ReloadEvery disabled");
            return;
        }

        if (tab.reloadEveryEnabled == false){
            tab.postDataAcceptedByUser = false;
            this.debug("reloadPage(...) : ReloadEvery disabled");
            return;
        }

        this.debug("reloadPage(...) : " + reloadEveryTabID + "reloading url :" + tab.webNavigation.currentURI.spec);
        var loadFlags = nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY | nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
        var entry=tab.webNavigation.sessionHistory.getEntryAtIndex(tab.webNavigation.sessionHistory.index, false);
        var postData = entry.QueryInterface(Components.interfaces.nsISHEntry).postData;
        var referrer = entry.QueryInterface(Components.interfaces.nsISHEntry).referrerURI;
    
        if ((postData != null) && (tab.postDataAcceptedByUser == false)) {
            var params = {result: null}; ;
            window.openDialog("chrome://reloadevery/content/warnPostData.xul", "",
                              "chrome,centerscreen,modal", params);
            if (params.result) {
                this.debug("reloadPage(...) : POSTDATA accepted");
                tab.postDataAcceptedByUser = true;
            }
            else {
                this.debug("reloadPage(...) : POSTDATA not accepted");
                tab.reloadEveryEnabled=false;
                return;           
            }        
        }                      
        tab.curScrollX = tab.contentWindow.scrollX;
        tab.curScrollY = tab.contentWindow.scrollY;
        this.debug("Current scroll position " + tab.curScrollX + ", "+ tab.curScrollY);

        var notifyFlags = Components.interfaces.nsIWebProgress.NOTIFY_ALL;
        tab.webProgress.addProgressListener(tab.reloadEveryProgressListener, notifyFlags);         
        tab.webNavigation.loadURI(tab.webNavigation.currentURI.spec, loadFlags, referrer, entry.postData, null);                                              
    },

    reloadEvery: function(tab) {
        this.debug("reloadEvery");

        var milliSeconds = tab.reloadEveryReloadTime*1000;
        if (tab.randomize) {
            milliSeconds = (Math.random() + 0.5) * milliSeconds;
        }
        this.debug("reloadEvery(" + milliSeconds + ")");

        return tab.reloadEveryTimerID=setTimeout("org.mozdev.reloadevery.reloadPage(\"" + tab.id + "\");", milliSeconds);  
    },

    enable: function(tab){
        this.debug("enable(tab)");
        tab.reloadEveryEnabled = true;
        clearInterval(tab.reloadEveryTimerID);
        tab.reloadEveryTimerID=this.reloadEvery(tab);  
    },

    disable: function(tab) {
        this.debug("disable(tab)");
        clearInterval(tab.reloadEveryTimerID);
        tab.reloadEveryEnabled = false;
        tab.postDataAcceptedByUser = false;
    },

    toggle: function() { 
        this.debug("toggle()");
        var tab = this.getCurTab();
        if (tab.reloadEveryEnabled) {
            this.disable(tab);
        }
        else {
            this.enable(tab);    
        }
    },

    randomize: function() { 
        this.debug("randomize()");
        var tab = this.getCurTab();
        if (tab.randomize) {
            tab.randomize = false;
        }
        else {
            tab.randomize = true;
        }
        this.prefs.setBoolPref("randomize", tab.randomize);    
    },

    setReloadTime: function(reloadTime) {
        this.debug ("setReloadTime(" + reloadTime + ")");

        this.getCurTab().reloadEveryReloadTime=reloadTime;
        this.prefs.setIntPref("reload_time", this.getCurTab().reloadEveryReloadTime);    
        this.enable(this.getCurTab());
    },

    setReloadTimeCustom: function() {
        this.debug("setReloadTimeCustom()");
        var params = {result: null}; ;
        window.openDialog("chrome://reloadevery/content/reloadeveryCustomDialog.xul", "",
                          "chrome,centerscreen,modal", params);

        if (params.result) {
            this.debug("onReloadEveryCustom() accepted");
            this.getCurTab().reloadEveryReloadTime=this.prefs.getIntPref("custom_reload_time");         
            this.enable(this.getCurTab());
        }
    },

    customDialogLoadSettings: function () {
        this.debug("customDialogLoadSettings()");
        // Runs in other dialog so we need to load prefs again
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"].
                        getService(Components.interfaces.nsIPrefService).getBranch("reloadevery.");

        var customReloadTime = this.prefs.getIntPref("custom_reload_time");
        document.getElementById("reload_every_minutes").value = Math.floor(customReloadTime / 60);
        document.getElementById("reload_every_seconds").value = customReloadTime % 60;
    },

    customDialogSaveSettings: function() {
        this.debug("reloadeveryCustomDialogSaveSettings()");
 
        var minutes;

        if (document.getElementById("reload_every_minutes").value != '') {
            minutes = parseInt(document.getElementById("reload_every_minutes").value);
        }
        else {
            minutes = 0;
        }
        var seconds;
        if (document.getElementById("reload_every_seconds").value != '') {
            seconds = parseInt(document.getElementById("reload_every_seconds").value);
        }
        else {
          seconds = 0;
        }

        var customReloadTime = minutes*60 + seconds;
        this.prefs.setIntPref("custom_reload_time", customReloadTime);
        this.prefs.setIntPref("reload_time", customReloadTime);
    
        return true;
    },

    enableAllTabs: function() { 
        this.debug("onReloadEveryEnableAllTabs() Number of tabs :" + getBrowser().browsers.length);

        for (i = 0; i < getBrowser().browsers.length; i++) {
           var tab = getBrowser().browsers[i];
            
           if (tab.reloadEveryEnabled == null){
                this.setupTab(tab);
           }
       
           if (tab.reloadEveryEnabled != true){
                this.enable(tab);
           }       
        }
    },


    disableAllTabs: function() { 
        this.debug("disableAllTabs()");

        for (i = 0; i < getBrowser().browsers.length; i++) {
            var tab = getBrowser().browsers[i];
       
            if (tab.reloadEveryEnabled == true) {
                this.disable(tab);
           }       
        }
    },


    onKeyPressInURLBar: function () {
        if (this.getCurTab().reloadEveryEnabled){
            this.debug("onKeyPressInURLBar(): disabling reload every");
            this.getCurTab().reloadEveryEnabled = false;
            this.getCurTab().postDataAcceptedByUser = false;
            clearInterval(this.getCurTab().reloadEveryTimerID);
        }
    },

    progressListener: function (tab){
        return ({

            QueryInterface : function(aIID){        
                if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
                    aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
                    aIID.equals(Components.interfaces.nsISupports)){
                    return this;
                }
                throw Components.results.NS_NOINTERFACE;
            },    
            onProgressChange : function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress,
                                         aCurTotalProgress, aMaxTotalProgress){
            },

            onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus){

                if ((aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_WINDOW) && 
                    (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)) {        
                    org.mozdev.reloadevery.debug("reloadEveryProgressListener(): page loaded " + tab.id);
                    tab.webProgress.removeProgressListener(tab.reloadEveryProgressListener);
                    org.mozdev.reloadevery.debug("scroll to " + tab.curScrollX + "," + tab.curScrollY);
                    tab.contentWindow.scrollTo(tab.curScrollX, tab.curScrollY); 
                    if (tab.reloadEveryEnabled) {
                        org.mozdev.reloadevery.debug("onStateChange: reloading again");

                        tab.reloadEveryTimerID=org.mozdev.reloadevery.reloadEvery(tab);
                    }
                }
            },

            onLocationChange : function(aWebProgress, aRequest, aLocation){
                org.mozdev.reloadevery.debug("onLocationChange");
            },

            onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage){
                org.mozdev.reloadevery.debug("onStatusChange");
            },

            onSecurityChange : function(aWebProgress, aRequest, aState){
                org.mozdev.reloadevery.debug("onSecurityChange");
            }
        });     
    }
} // end org.mozdev.reloadevery



// Every time a new browser window is made init will be called
window.addEventListener("load",function() {org.mozdev.reloadevery.init()},false);


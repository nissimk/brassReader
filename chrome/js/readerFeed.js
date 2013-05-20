function ReaderFeedList() {
  this.activeFeed = '';
  this.tree = [];  //items will either be url or {name: <folder name>, items: [list of feed urls in folder], isOpen: T/F}
  this.feeds = {}; // keys are url; items are readerFeed
  this.ids = {};  //keys are url or folder name; value is string with html id of element in list
  this.timer = null;
  this.isShowReadItems = true;
}

ReaderFeedList.prototype = {
  loadFromStorage: function() {
    var objectStore = reader.db.transaction("feedlist").objectStore("feedlist");
    var that = this;
    objectStore.openCursor().onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        var val = cursor.value;
        that.tree = val.tree;
        var feeds = that.feeds;
        $.each(val.feeds, function(i, url) {
          feeds[url] = null;
        });
        that.displayList(function() {
          that.selectFeedOrFolder(val.activeFeed);
          that.updateAllFeeds();
        });
      }
    };
  },
  loadFromOPML: function(opml) {
    //right now this will blow away the list and replace by the OPML
    //later add an option to merge
    var oldFeeds = this.feeds;
    this.tree = [];
    this.feeds = {};
    this.ids = {};
    var that = this;
    var addFeed = function(node) {
      var url = node.attributes.xmlUrl.value;
      if (url in oldFeeds) {
        that.feeds[url] = oldFeeds[url];
      } else {
        that.feeds[url] = null;
      }
      return url;
    };
    $.each($("body > outline", opml), function(i, val) {
      if (val.childNodes.length === 0) {
        that.tree.push(addFeed(val));
      } else {
        var folder = {name: val.attributes.title.value, isOpen: true, items: []};
        $.each(val.childNodes, function(j, val2) {
          if (val2.attributes !== null) {
            folder.items.push(addFeed(val2));
          }
        });
        that.tree.push(folder);
      }
    });
    this.saveToStorage();
    this.displayList(function() { that.updateAllFeeds(); });
  },
  saveToStorage: function() {
    //Open a transaction with a scope of data stores and a read-write mode.
    var trans = reader.db.transaction(['feedlist'], 'readwrite');
     
    //"objectStore()" is an IDBTransaction method that returns an object store 
    //that has already been added to the scope of the transaction.  
    var store = trans.objectStore('feedlist');
    var obj = this.serialize();
    console.log("writing feedList to database", obj);
    var req = store.put(obj, 1); 
    req.onsuccess = function() { window.console && console.log('successfully wrote feedlist to db'); };
    req.onerror = function() { window.console && console.log('failed to write feedlist to db'); };
  },
  serialize: function() {
    var obj = {};
    obj.activeFeed = this.activeFeed;
    obj.tree = this.tree;
    obj.feeds = Object.keys(this.feeds);
    return obj;
  },
  addFeed: function(url) {
    var newFeed = new ReaderFeed(url);
    var len = this.tree.push(url);
    var id = "list-" + String(len - 1);
    this.ids[url] = id;
    this.feeds[url] = newFeed;
    var that = this;
    newFeed.updateFeed(function(feed) {
      $("#feedList").append('<li id="' + id + '">' + feed.title + '<span id="' + id + '-unread"> (' + feed.unread + ")</span></li>");
      that.selectFeed(url);
      that.saveToStorage();
    });
  },
  selectFeedOrFolder: function(urlOrFolderName) {
    var that = this;
    $.each(this.tree, function(i, val) {
      if (typeof val === "string" && val === urlOrFolderName)
        that.selectFeed(urlOrFolderName);
      else if (typeof val !== "string" && val.name === urlOrFolderName)
        that.selectFolder(urlOrFolderName);
    });
  },
  selectFeed: function(url) {
    if (this.activeFeed !== '') {
      oldActiveId = this.ids[this.activeFeed];
      $("#" + oldActiveId).css("font-weight", "normal");
    }
    $("#" + this.ids[url]).css("font-weight", "bold");
    if (this.feeds[url] == null) {
      var feed = new ReaderFeed(url);
      this.feeds[url] = feed;
      feed.loadFromStorage(function() { feed.displayFeed(); });
    } else {
      this.feeds[url].displayFeed();
    }
    this.activeFeed = url
    this.saveToStorage();
  },
  selectFolder: function(folder) {
    if (this.activeFeed !== '') {
      oldActiveId = this.ids[this.activeFeed];
      $("#" + oldActiveId).css("font-weight", "normal");
    }
    $("#" + this.ids[folder]).css("font-weight", "bold");
    var itms = [];
    var fld;
    var that = this;
    console.log("Finding Folder", new Date());
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val) && val.name === folder)
        fld = val;
    });
    console.log("Found Folder about to create items array", new Date());
    $.each(fld.items, function(i, feed) {
      for (var key in that.feeds[feed].items) {
        itms.push(that.feeds[feed].items[key]);
      }
    });
    console.log("created items array about to sort", new Date());
    itms.sort(function(a, b) { return b.updated - a.updated; });
    console.log("items array sorted about to display " + itms.length, new Date());
    this.showItems(itms, true);
    console.log("displayed items", new Date());
    this.activeFeed = folder;
    this.saveToStorage();
  },
  displayList: function(callback) {
    this.ids = {};
    $("#feedList").empty();
    var that = this;
    var promises = [];
    $.each(this.tree, function(i, val) {
      var showFeed = function(feed, id, list_id) {
        var link = $('<li id="' + id + '"><a href="#">' + feed.title + '<span id="' + id + '-unread"> (' + feed.unread + ')</span></a></li>');
        link.click(function(event) { reader.feedList.selectFeed(feed.url); });
        $(list_id).append(link);
        that.ids[feed.url] = id;
      };
      var getAndShowFeed = function(url, id, list_id) {
        var feed = that.feeds[url];
        if (feed == null) {
          feed = new ReaderFeed(url);
          promises.push(feed.loadFromStorage(function() { showFeed(feed, id, list_id); }));
          that.feeds[url] = feed;
        } else {
          showFeed(feed, id, list_id);
        }
      };
     if (typeof val === "string") {  //val is a feed
       getAndShowFeed(val, "list-" + i, "#feedList");
     } else {   //val is a folder
        var id = "list-" + i;
        if (val.isOpen) {
          var caret = $('<div class="divlink"><i class="icon-caret-down"></i></div>');
          caret.click(function(event) { reader.feedList.closeFolder(val.name); });
        }
        else {
          var caret = $('<div class="divlink"><i class="icon-caret-right"></i></div>');
          caret.click(function(event) { reader.feedList.openFolder(val.name); });
        }
        var link = $('<li id="' + id + '"><a href="#"><span><i class="icon-folder-close"></i>' + val.name + 
                      '</span></a></li><ul class="nav nav-list" id="sublist-' + i + '"></ul>');
        $("span", link).click(function(event) { reader.feedList.selectFolder(val.name); });
        $("#feedList").append(link);
        $("#" + id + " a").prepend(caret);
        that.ids[val.name] = id;
        $.each(val.items, function(j, val2) {
          getAndShowFeed(val2, "list-" + i + "-" + j, "#sublist-" + i);
        });
        if (!val.isOpen) 
          $("#sublist-" + i).hide();
      }
    });
    $.when.apply(null, promises).then(callback);
  },
  updateUnread: function(url, count) {
    var id = this.ids[url];
    $('#' + id + '-unread').text(' (' + count + ')');
  },
  updateAllFeeds: function() {
    console.log("About to update all feeds");
    clearTimeout(this.timeout);
    for (var url in this.feeds) {
      var feed = this.feeds[url];
      feed.updateFeed();
    }
    this.timeout = setTimeout(function() {
      reader.feedList.updateAllFeeds();
    }, 3 * 60 * 1000);

  },
  openItem: function(item, row) {
    if (typeof reader.openItem !== "undefined") {
      reader.openItem.prev().removeClass("info");
      reader.openItem.remove();
    }
    var title = '<h4><a href="' + item.link + '">' + item.title + '</a></h4>';
    newRow = $('<tr class="openItemRow"><td colspan=' + row.children().length  + ' class="openItemCell"><div class="itemContent">' + 
                title + item.description + '</div></td></tr>');
    $("a", newRow).attr("target", "_blank");
    row.after(newRow);
    row.addClass("info");
    reader.openItem = newRow;
    item.markRead();
    row.unbind('click').click(function(event) { reader.feedList.closeItem(item, row); });
  },
  closeItem: function(item, row) {
    delete reader.openItem;
    row.next().remove();
    row.unbind('click').click(function(event) { reader.feedList.openItem(item, row); });
    row.removeClass("info");
  },
  showItems: function(items, isShowFeed) {
    $("#storyList").empty();
    var that = this;
    $.each(items, function(i, val) {
      var feed = that.feeds[val.feed];
      if (that.isShowReadItems || !val.marked) {
        var row = $($.parseHTML('<tr class="item" id="item-' + val.id + '"></tr>'));
        row.click(function(event) { reader.feedList.openItem(val, row); });
        $("#storyList").append(row);
        if (isShowFeed) 
          row.append('<td class="itemFeedName">' + feed.title + "</td>");
        var shortDesc = $("<div>" + val.description + "</div>").text().substring(0, 100);
        var titleClass = "itemTitleUnread";
        if (val.marked) {
          titleClass = "itemTitleRead";
        }
        row.append('<td class="itemTitleDesc"><div class="' + titleClass + '">' + 
                    val.title + '</div><span class="shortDesc"> - ' + shortDesc + "</div></td>");
        row.append('<td class="itemDateTime">' + new Date(val.updated).toDateOrTimeStr() + "</td>");
      }
    });
  },
  openFolder: function(folder) {
    var id = this.ids[folder];
    $("#sub" + id).show();
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val) && val.name == folder)
        val.isOpen = true;
    });
    var caret = $("#" + id).find(".icon-caret-right");
    caret.removeClass("icon-caret-right").addClass("icon-caret-down");
    caret.parent().unbind('click').click(function(event) { reader.feedList.closeFolder(folder); });
    this.saveToStorage();
  },
  closeFolder: function(folder) {
    var id = this.ids[folder];
    $("#sub" + id).hide();
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val) && val.name == folder)
        val.isOpen = false;
    });
    var caret = $("#" + id).find(".icon-caret-down");
    caret.removeClass("icon-caret-down").addClass("icon-caret-right");
    caret.parent().unbind('click').click(function(event) { reader.feedList.openFolder(folder); });
    this.saveToStorage();
  },
  refresh: function() {
    this.selectFeed(this.activeFeed);
  },
  markAllRead: function() {
    var that = this;
    $.each(this.tree, function(i, val) {
      if (typeof val === "string" && val === this.activeFeed)
        that.feeds[val].markAllRead();
      else if (typeof val !== "string" && val.name === urlOrFolderName) {
        $.each(val.items, function(j, url) {
          that.feeds[url].markAllRead();
        });
        that.selectFolder(urlOrFolderName);
      }
    });
    this.refresh();
  }
}

function ReaderFeed(url) {
  this.url = url;
  this.lastLoaded = new Date(1990, 1, 1);
  this.title = '';
  this.description = '';
  this.language =  '';
  this.items = {};    // keyed by ID
  this.unread = 0;
 }

ReaderFeed.prototype = {
  updateFeed: function(onComplete) {
    var that = this;
    console.log("updating feed: ", this);
    $.getFeed({
      url: that.url,
      success: function(feed) {
        that.lastLoaded = new Date().getTime();
        that.title = feed.title;
        that.description = feed.description;
        that.language = feed.language;

        $.each(feed.items, function(i, val) {
          if (val.id || "" === "") {
            //might want to exclude the title before hashing
            val.id = JSON.stringify(val).hashCode();
          }
          //console.log("item: ", val);
          if (!(val.id in that.items)) {
            if (val.updated || "" === "") {
              val.updated = new Date().getTime();
            }
            val.feed = that.url;
            val.marked = false;
            $.extend(val, val, reader.itemFunctions);
            val.saveToStorage();
            that.items[val.id] = val;
            that.unread++;
          }
        });
        that.saveToStorage();
        reader.feedList.updateUnread(that.url, that.unread);
        if (typeof onComplete === "function") {
          onComplete(that);
        }
      },
      failure: function(xhr, msg, e){
        window.console && console.log('getFeed failed to load feed', xhr, msg, e);
        if (typeof onComplete === "function") {
          onComplete(that);
        }
      },
      error: function(xhr, msg, e){
        window.console && console.log('getFeed failed to load feed', xhr, msg, e);
        if (typeof onComplete === "function") {
          onComplete(that);
        }
      }
    });
  },
  displayFeed: function() {
    var itms = [];
    for (var key in this.items) {
      itms.push(this.items[key]);
    }
    itms.sort(function(a, b) { return b.updated - a.updated; });
    reader.feedList.showItems(itms, false);
  },
  markAllRead: function() {
    var that = this;
    $.each(this.items, function(i, item) {
      item.markRead();
    });
  },
  serialize: function() {
    //return json of properties excluding items list
    obj = {};
    obj.url = this.url;
    obj.lastLoaded = this.lastLoaded;
    obj.description = this.description;
    obj.title = this.title;
    obj.language = this.language;
    return obj;
  },
  saveToStorage: function() {
    //Open a transaction with a scope of data stores and a read-write mode.
    var trans = reader.db.transaction(['feeds'], 'readwrite');
     
    //"objectStore()" is an IDBTransaction method that returns an object store 
    //that has already been added to the scope of the transaction.  
    var store = trans.objectStore('feeds');
    var req = store.put(this.serialize()); 
    req.onsuccess = function() { window.console && console.log('successfully wrote feed to db'); };
    req.onerror = function() { window.console && console.log('failed to write feed to db'); };
  },
  loadFromStorage: function(doneCallBack) {
    var that = this;
    var dfd = $.Deferred();
    var trans = reader.db.transaction('feeds').objectStore('feeds').get(that.url).onsuccess = function (event) {
      obj = event.target.result;
      if (typeof obj === "undefined") {
        //it's not in the database...update feed from rss server
        that.updateFeed(dfd.resolve);
      } else {
        that.lastLoaded = obj.lastLoaded;
        that.title = obj.title;
        that.description = obj.description;
        that.language = obj.language;
        //use a cursor here to retrieve all items from this feed
        var itemStore = reader.db.transaction('items').objectStore('items');
        var feedIndex = itemStore.index("feed");
        feedIndex.openCursor(IDBKeyRange.only(that.url)).onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            var itm = cursor.value
            $.extend(itm, itm, reader.itemFunctions);
            that.items[itm.id] = itm;
            if (! itm.marked) {
              that.unread++;
            }
            cursor.continue();
          } 
          else {
            if ($.isFunction(doneCallBack)) {
              doneCallBack();
            }
            dfd.resolve();
          }
        };
      }
    };
    return dfd.promise();
  }
}

reader.itemFunctions = {
  markRead: function() {
    this.marked = true;
    $("#item-" + this.id).find(".itemTitleUnread").removeClass("itemTitleUnread").addClass("itemTitleRead");
    this.saveToStorage();
    var feed = reader.feedList.feeds[this.feed];
    feed.unread--;
    reader.feedList.updateUnread(feed.url, feed.unread);
  },
  saveToStorage: function() {
    //Open a transaction with a scope of data stores and a read-write mode.
    var trans = reader.db.transaction(['items'], 'readwrite');
     
    //"objectStore()" is an IDBTransaction method that returns an object store 
    //that has already been added to the scope of the transaction.  
    var store = trans.objectStore('items');
    var copy = {};
    for (var key in this) {
      if (!($.isFunction(this[key]))) {
        copy[key] = this[key];
      }
    }
    //console.log("about to store item");
    //console.log(copy);
    var req = store.put(copy); 
    req.onsuccess = function() { window.console && console.log('successfully wrote item to db'); };
    req.onerror = function() { window.console && console.log('failed to write item to db'); };
  }
}

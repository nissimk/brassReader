function ReaderFeedList() {
  this.activeFeed = '';
  this.tree = [];  //items will either be url or {name: <folder name>, items: [list of feed urls in folder], isOpen: T/F}
  this.feeds = {}; // keys are url; items are readerFeed
  this.ids = {};  //keys are url or folder name; value is string with html id of element in list
  this.timeout = null;
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
        that.isShowReadItems = val.isShowReadItems;
        that.tree = val.tree;
        var feeds = that.feeds;
        $.each(val.feeds, function(i, url) {
          feeds[url] = null;
        });
        that.displayList(function() {
          that.selectFeedOrFolder(val.activeFeed);
          that.updateAllFeeds();
        });
      } else {
        that.displayList();
      }
    };
  },
  addFeedForImport: function(url, oldFeeds, title) {
    if (url in oldFeeds) {
      this.feeds[url] = oldFeeds[url];
    } else {
      this.feeds[url] = new ReaderFeed(url);
      this.feeds[url].title = title;
      this.feeds[url].saveToStorage();
    }
    return url;
  },
  loadFromOPML: function(opml) {
    //right now this will blow away the list and replace by the OPML
    //later add an option to merge
    var oldFeeds = this.feeds;
    this.tree = [];
    this.feeds = {};
    this.ids = {};
    var that = this;
    $.each($("body > outline", opml), function(i, val) {
      if (val.childNodes.length === 0) {
        that.tree.push(that.addFeedForImport(val.attributes.xmlUrl.value, oldFeeds, val.attributes.title.value));
      } else {
        var folder = {name: val.attributes.title.value, isOpen: true, items: [], unread: 0, order: 1};
        $.each(val.childNodes, function(j, val2) {
          if (val2.attributes !== null) {
            folder.items.push(that.addFeedForImport(val2.attributes.xmlUrl.value, oldFeeds, val2.attributes.title.value));
          }
        });
        that.tree.push(folder);
      }
    });
    this.saveToStorage();
    this.displayList(function() { that.updateAllFeeds(); });
  },
  getFolder: function(fld) {
    var folder = null;
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val) && val.name == fld)
        folder = val;
    });
    return folder;
  },
  getFolders: function() {  //return an array of folder names
    var ret = [];
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val))
        ret.push(val.name);
    });
    return ret;
  },
  importGReader: function() {
    var oldFeeds = this.feeds;
    this.tree = [];
    this.feeds = {};
    this.ids = {};
    var that = this;
    $.get("http://www.google.com/reader/api/0/subscription/list?output=json", function(data) {
      //console.log(data);
      $.each(data.subscriptions, function(i, val) {
        var url = that.addFeedForImport(val.id.substr(5), oldFeeds, val.title);
        if (val.categories.length) {
          var folder = that.getFolder(val.categories[0].label);
          if (folder === null)
          {
            folder = {name: val.categories[0].label, items: [], isOpen: true, unread: 0, order: 1};
            that.tree.push(folder);
          }
          folder.items.push(url);
        } else {
          that.tree.push(url);
        }
      });
      that.saveToStorage();
      that.displayList(function() { that.updateAllFeeds(); });
    }, "json");
  },
  saveToStorage: function() {
    //Open a transaction with a scope of data stores and a read-write mode.
    var trans = reader.db.transaction(['feedlist'], 'readwrite');
     
    //"objectStore()" is an IDBTransaction method that returns an object store 
    //that has already been added to the scope of the transaction.  
    var store = trans.objectStore('feedlist');
    var obj = this.serialize();
    //console.log("writing feedList to database", obj);
    var req = store.put(obj, 1); 
    req.onsuccess = function() { 
      //window.console && console.log('successfully wrote feedlist to db'); 
    };
    req.onerror = function() { window.console && console.log('failed to write feedlist to db'); };
  },
  serialize: function() {
    var obj = {};
    obj.activeFeed = this.activeFeed;
    obj.tree = this.tree;
    obj.feeds = Object.keys(this.feeds);
    obj.isShowReadItems = this.isShowReadItems;
    return obj;
  },
  renderFeed: function(feed, id, list_id) {
    var index = id.slice(5);  //strip off the list-
    var link = $(reader.templates.feedItemInTree(id, feed.title, feed.unread));
    link.click(function(event) { reader.feedList.selectFeed(feed.url); });
    $(list_id).append(link);
    var dropdown = $("#divFeedDropDown").clone().attr("id", "divFeedDropDown-" + index).addClass("pull-right");
    dropdown.prepend($(reader.templates.feedDropdownTrigger(index)));
    $("#" + id).prepend(dropdown)
        .hover(function(event) { $("#feedMenu-" + index).show(); },
               function(event) { $("#feedMenu-" + index).hide(); });
    $("#" + id + " #mnuSortByOldest").click(function(event) { reader.feedList.sort(feed.url, -1); });
    $("#" + id + " #mnuSortByNewest").click(function(event) { reader.feedList.sort(feed.url, 1); });
    $("#" + id + " #mnuMoveToFolder").click(function(event) { reader.handlers.moveToFolder(feed.url); });
    $("#" + id + " #mnuUnsubscribe").click(function(event) { reader.feedList.unsubscribe(feed.url); });
    $("#" + id + " #mnuMarkAllRead").click(function(event) { reader.feedList.markAllRead(feed.url); });
    this.ids[feed.url] = id;
  }, 
  addFeed: function(url) {
    var newFeed = new ReaderFeed(url);
    var len = this.tree.push(url);
    var id = "list-" + String(len - 1);
    this.feeds[url] = newFeed;
    var that = this;
    newFeed.updateFeed(function(feed) {
      renderFeed(newFeed, id, "#feedList");
      that.selectFeed(url);
      that.saveToStorage();
    });
  },
  renderFolder: function(folder, i) {
    var id = "list-" + i;
    this.ids[folder.name] = id;
    var caret = $(reader.templates.folderCaret(folder.isOpen));
    if (folder.isOpen) {
      caret.click(function(event) { reader.feedList.closeFolder(folder.name); });
    }
    else {
      caret.click(function(event) { reader.feedList.openFolder(folder.name); });
    }
    var dropdown = $("#divFolderDropDown").clone().attr("id", "divFolderDropDown-" + i).addClass("pull-right");
    dropdown.prepend($(reader.templates.folderDropdownTrigger(i)));
    var link = $(reader.templates.folderItemInTree(id, folder.name, folder.unread));
    $("a", link).click(function(event) { reader.feedList.selectFolder(folder.name); });
    $("#feedList").append(link);
    $("#" + id).prepend(dropdown).prepend(caret)
        .hover(function(event) { $("#folderMenu-" + i).show(); },
               function(event) { $("#folderMenu-" + i).hide(); });
    $("#" + id + " #mnuSortByOldest").click(function(event) { reader.feedList.sort(folder.name, -1); });
    $("#" + id + " #mnuSortByNewest").click(function(event) { reader.feedList.sort(folder.name, 1); });
    $("#" + id + " #mnuRenameFolder").click(function(event) { reader.handlers.renameFolder(folder.name); });
    $("#" + id + " #mnuDeleteFolder").click(function(event) { reader.feedList.deleteFolder(folder.name); });
    $("#" + id + " #mnuUnsubscribeAll").click(function(event) { reader.feedList.unsubscribe(folder.name); });
    $("#" + id + " #mnuMarkAllRead").click(function(event) { reader.feedList.markAllRead(folder.name); });
    return link;
  },
  addFolder: function(folderName) {
    var folder = {name: folderName, items: [], isOpen: true, unread: 0, order: 1};
    var len = this.tree.push(folderName);
    var i = len - 1;
    this.renderFolder(folder, i);
    this.saveToStorage();
  },
  deleteFolder: function(folderName) {
    var folder = this.getFolder(folderName);
    var that = this;
    $.each(folder.items, function(i, val) {
      that.tree.push(val);
    });
    this.tree.splice(this.tree.indexOf(folder), 1);
    if (this.activeFeed === folderName && folder.items.length > 0)
      this.activeFeed = folder.items[0];
    else if (this.activeFeed === folderName && this.tree.length > 0) {
      if (typeof this.tree[0] === "string")
        this.activeFeed === this.tree[0];
      else 
        this.activeFeed === this.tree[0].name;
    }
    else if (this.activeFeed === folderName)
      this.activeFeed = "";
    this.saveToStorage();
    var that = this;
    this.displayList(function() {
      that.selectFeedOrFolder(that.activeFeed);
    });
  },
  renameFolder: function(folderName, newFolderName) {
    var folder = this.getFolder(folderName);
    folder.name = newFolderName;
    this.ids[newFolderName] = this.ids[folderName];
    delete this.ids[folderName];
    $("#" + this.ids[newFolderName] + "-name").text(newFolderName);
  },
  unsubscribe: function(urlOrFolderName, showTree) {
    if (urlOrFolderName in this.feeds) {
      if (typeof showTree === "undefined")
        showTree = true;
      this.feeds[urlOrFolderName].removeFromStorage();
      delete this.feeds[urlOrFolderName];
      var that = this;
      $.each(this.tree, function(i, val) {
        if (typeof val !== "string" && val.items.indexOf(urlOrFolderName) >= 0) {
          val.items.splice(val.items.indexOf(urlOrFolderName), 1);
        }
      });
      if  (this.tree.indexOf(urlOrFolderName) >= 0) {
        this.tree.splice(this.tree.indexOf(urlOrFolderName), 1);
      }
      this.saveToStorage();
      if (this.activeFeed === urlOrFolderName && this.tree.length > 0) {
        if (typeof this.tree[0] === "string")
          this.activeFeed === this.tree[0];
        else 
          this.activeFeed === this.tree[0].name;
      } else {
        this.activeFeed = "";
      }
      if (showTree)
        this.displayList(function() { that.selectFeedOrFolder( that.activeFeed ); });
    } else {
      var folder = this.getFolder(urlOrFolderName);
      while (folder.items.length > 0) {
        this.unsubscribe(folder.items[0], false);
      }
      this.displayList(function() { that.calcAllFoldersUnread(); that.selectFeedOrFolder( that.activeFeed ); });
    }
  },
  displayList: function(callback) {
    $("#btnShowReadItems").html(reader.templates.btnShowReadItemsCaption(this.isShowReadItem));
    this.ids = {};
    $("#feedList").empty();
    if (this.tree.length === 0) {
      $("#storyList").empty();
      $("#storyList").append(reader.templates.newUserMessage);
    } else {
      var that = this;
      var promises = [];
      $.each(this.tree, function(i, val) {
        var getAndShowFeed = function(url, id, list_id, folder) {
          var feed = that.feeds[url];
          if (typeof feed === "undefined" || feed === null || Object.keys(feed.items).length === 0) {
            if (typeof feed === "undefined" || feed === null) {
              feed = new ReaderFeed(url);
            }
            promises.push(feed.loadFromStorage(function() { that.renderFeed(feed, id, list_id); feed.folder = folder }));
            that.feeds[url] = feed;
          } else {
            that.renderFeed(feed, id, list_id);
          }
        };
        if (typeof val === "string") {  //val is a feed
          getAndShowFeed(val, "list-" + i, "#feedList", null);
        } else {   //val is a folder
          var id = "list-" + i;
          that.renderFolder(val, i);
          $.each(val.items, function(j, val2) {
            getAndShowFeed(val2, "list-" + i + "-" + j, "#sublist-" + i, val.name);
          });
          if (!val.isOpen) 
            $("#sublist-" + i).hide();
        }
      });
      $.when.apply(null, promises).then(function() { 
        that.calcAllFoldersUnread(); 
        if ($.isFunction(callback)) { callback(); }
      });
    }
  },
  sort: function(urlOrFolderName, order) {
    if (urlOrFolderName in this.feeds) {
      var feed = this.feeds[urlOrFolderName];
      feed.order = order;
      feed.saveToStorage();
    } else {
      var folder = this.getFolder(urlOrFolderName);
      folder.order = order;
      this.saveToStorage();
    }
    if (this.activeFeed === urlOrFolderName)
      this.refresh();
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
    if (this.feeds[url] === null || Object.keys(this.feeds[url].items).length === 0) {
      if (this.feeds[url] === null) {
        var feed = new ReaderFeed(url);
        this.feeds[url] = feed;
      } else {
        var feed = this.feeds[url];
      }
      feed.loadFromStorage(function() { feed.displayFeed(); });
    } else {
      this.feeds[url].displayFeed();
    }
    this.activeFeed = url
    this.saveToStorage();
  },
  selectFolder: function(folder) {
    if (reader.feedList.elementWatcher) {
      reader.feedList.elementWatcher.destroy;
    }
    if (this.activeFeed !== '') {
      oldActiveId = this.ids[this.activeFeed];
      $("#" + oldActiveId).css("font-weight", "normal");
    }
    $("#" + this.ids[folder]).css("font-weight", "bold");
    var itms = [];
    var fld = this.getFolder(folder);
    var that = this;
    $.each(fld.items, function(i, feed) {
      for (var key in that.feeds[feed].items) {
        itms.push(that.feeds[feed].items[key]);
      }
    });
    itms.sort(function(a, b) { return fld.order * (b.updated - a.updated); });
    this.showItems(itms, true);
    this.activeFeed = folder;
    this.saveToStorage();
  },
  calcAllFoldersUnread: function() {
    var that = this;
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val)) {
        total = 0;
        $.each(val.items, function(j, feed) {
          total += that.feeds[feed].unread;
        });
        val.unread = total;
        that.updateUnread(val.name, total);
      }
    });
  },
  updateUnread: function(url, count) {
    var id = this.ids[url];
    $('#' + id + '-unread').text(' (' + count + ')');
  },
  updateAllFeeds: function() {
    //console.log("About to update all feeds");
    clearTimeout(this.timeout);
    this.timeout = setTimeout(function() {
      reader.feedList.updateAllFeeds();
    }, 3 * 60 * 1000);
    for (var url in this.feeds) {
      var feed = this.feeds[url];
      feed.updateFeed();
    }
  },
  openItem: function(item, row) {
    if (typeof reader.openItem !== "undefined") {
      reader.openItem.prev().removeClass("info");
      reader.openItem.remove();
    }
    newRow = $(reader.templates.itemRowOpen(row.children().length, item.link, 
         item.title, item.description ));
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
  showItems: function(items, isShowFeed, startAt) {
    this.feedItems = items
    if (typeof startAt === "undefined")
      startAt = 0;
    if (startAt === 0)
      $("#storyList").empty();
    var that = this;
    var rowCount = 0;
    var watcherRow = null;
    $.each(items.slice(startAt), function(i, val) {
      var feed = that.feeds[val.feed];
      if (that.isShowReadItems || !val.marked) {
        var row = $(reader.templates.itemRowClosed(val.id));
        row.click(function(event) { reader.feedList.openItem(val, row); });
        $("#storyList").append(row);
        if (isShowFeed) 
          row.append(reader.templates.feedTitleCell(feed.title));
        var shortDesc = $("<div>" + val.description + "</div>").text().substring(0, 100);
        var titleClass = "itemTitleUnread";
        if (val.marked) {
          titleClass = "itemTitleRead";
        }
        row.append(reader.templates.feedDescCell(val.title, titleClass, shortDesc));
        row.append(reader.templates.feedTimeCell(new Date(val.updated).toDateOrTimeStr()));
        if (rowCount++ === 42) {
          watcherRow = row;
        }
        if (rowCount === 50) {
          if (i < items.length - 1) {
            //add the scroll watcher
            that.elementWatcher = scrollMonitor.create(watcherRow);
            that.elementWatcher.enterViewport(function() {
              reader.feedList.showItems(reader.feedList.feedItems, isShowFeed, startAt + 50);
            });
            $(".right-section").unbind("scroll").scroll(function() { 
              reader.feedList.elementWatcher.recalculateLocation(); 
              scrollMonitor.update(); 
            });
          }
          return false;    //break out of $.each
        }
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
    var caret = $("#" + id).find(".folder-open-close");
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
    var caret = $("#" + id).find(".folder-open-close");
    caret.removeClass("icon-caret-down").addClass("icon-caret-right");
    caret.parent().unbind('click').click(function(event) { reader.feedList.openFolder(folder); });
    this.saveToStorage();
  },
  moveToFolder: function(url, folderName) {
    var folder = this.getFolder(folderName);
    var feed = this.feeds[url];
    var that = this;
    //remove feed from anywhere else in the tree
    $.each(this.tree, function(i, val) {
      if ($.isPlainObject(val)) {
        $.each(val.items, function(j, val2) {
          if (val2 == url)
            val.items.splice(j, 1);
        });
      } else {
        if (val == url)
          that.tree.splice(i, 1);
      }
    });
    if (folder == null) {
      feed.folder = null;
      this.tree.push(url);
    } else {
      feed.folder = folderName;
      folder.items.push(url);
    }
    feed.saveToStorage();
    this.saveToStorage();
    this.displayList(function() { that.calcAllFoldersUnread(); });
  }, 
  refresh: function() {
    this.selectFeedOrFolder(this.activeFeed);
  },
  markAllRead: function(urlOrFolderName) {
    if (typeof urlOrFolderName === "undefined")
      urlOrFolderName = this.activeFeed;
    var that = this;
    $.each(this.tree, function(i, val) {
      if (typeof val === "string" && val === urlOrFolderName)
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
  this.folder = null;
  this.nextUpdate = new Date();
  this.interval = 2;   //interval in minutes between updates
  this.isErrror = false;
  this.order = 1;    //1 = sort by newest, -1 = sort by oldest
 }

ReaderFeed.prototype = {
  updateFeed: function(onComplete) {
    if (this.nextUpdate > new Date() || this.isError) {
      return new $.Deferred().resolve();
    } else {
      var that = this;
      //console.log("updating feed: ", this);
      return $.getFeed({
        url: that.url,
        success: function(feed) {
          that.lastLoaded = new Date().getTime();
          that.title = feed.title;
          that.description = feed.description;
          that.language = feed.language;
          var isNewItems = false;

          $.each(feed.items, function(i, val) {
            if (val.id || "" === "") {
              //might want to exclude the title before hashing
              val.id = JSON.stringify(val).hashCode();
            }
            //console.log("item: ", val);
            if (!(val.id in that.items)) {
              isNewItems = true;
              if (val.updated || "" === "") {
                val.updated = new Date().getTime();
              }
              val.feed = that.url;
              val.marked = false;
              $.extend(val, val, reader.itemFunctions);
              val.saveToStorage();
              that.items[val.id] = val;
              that.unread++;
              if (that.folder !== null) {
                reader.feedList.getFolder(that.folder).unread++;
              }
            }
          });
          if (! that.interval) {
            that.interval = 2;
          }
          if (isNewItems && that.interval > 2) {
            that.interval /= 2;
          }
          if (!isNewItems && that.interval < 256) {
            that.interval *= 2;
          }
          if (!that.nextUpdate) {
            that.nextUpdate = new Date();
          }
          that.nextUpdate.setTime(new Date().getTime() + (that.interval * 60 * 1000));
          that.saveToStorage();
          reader.feedList.updateUnread(that.url, that.unread);
          if (that.folder !== null) {
            reader.feedList.updateUnread(that.folder, reader.feedList.getFolder(that.folder).unread);
          }
          if (typeof onComplete === "function") {
            onComplete(that);
          }
        },
        error: function(xhr, msg, e){
          if ((xhr.status >= 400 && xhr.status < 500) ||
              msg == "parsererror") {
            that.isError = true;
          } else {
            window.console && console.log('getFeed failed to load feed', xhr, msg, e, that);
          }
          if (typeof onComplete === "function") {
            onComplete(that);
          }
        }
      });
    }
  },
  displayFeed: function() {
    if (reader.feedList.elementWatcher) {
      reader.feedList.elementWatcher.destroy;
    }
    var itms = [];
    for (var key in this.items) {
      itms.push(this.items[key]);
    }
    var that = this;
    itms.sort(function(a, b) { return that.order * (b.updated - a.updated); });
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
    obj.folder = this.folder;
    obj.nextUpdate = this.nextUpdate;
    obj.interval = this.interval;
    obj.isError = this.isError;
    obj.order = this.order;
    return obj;
  },
  saveToStorage: function() {
    //Open a transaction with a scope of data stores and a read-write mode.
    var trans = reader.db.transaction(['feeds'], 'readwrite');
     
    //"objectStore()" is an IDBTransaction method that returns an object store 
    //that has already been added to the scope of the transaction.  
    var store = trans.objectStore('feeds');
    var req = store.put(this.serialize()); 
    req.onsuccess = function() { 
      //window.console && console.log('successfully wrote feed to db'); 
    };
    req.onerror = function() { window.console && console.log('failed to write feed to db'); };
  },
  removeFromStorage: function() {
    var that = this;
    //use a cursor here to delete all items from this feed
    var trans = reader.db.transaction(['items','feeds'], 'readwrite');
    var objectStore = trans.objectStore('items');
    var feedIndex = objectStore.index("feed");
    feedIndex.openCursor(IDBKeyRange.only(that.url)).onsuccess = function (event) {
      var cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } 
    }; 
    trans.objectStore('feeds').delete(this.url);
  },
  loadFromStorage: function(doneCallBack) {
    var that = this;
    var dfd = $.Deferred();
    var trans = reader.db.transaction('feeds').objectStore('feeds').get(that.url).onsuccess = function (event) {
      var cb = function() {
        if ($.isFunction(doneCallBack)) {
          doneCallBack();
        }
        dfd.resolve();
      };
      obj = event.target.result;
      if (typeof obj === "undefined") {
        //it's not in the database...update feed from rss server
        that.updateFeed(cb);
      } else {
        that.lastLoaded = obj.lastLoaded;
        that.title = obj.title;
        that.description = obj.description;
        that.language = obj.language;
        that.folder = obj.folder;
        that.nextUpdate = obj.nextUpdate;
        that.interval = obj.interval;
        that.isError = obj.isError
        //use a cursor here to retrieve all items from this feed
        var itemStore = reader.db.transaction('items').objectStore('items');
        var feedIndex = itemStore.index("feed");
        feedIndex.openCursor(IDBKeyRange.only(that.url)).onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor) {
            var itm = cursor.value;
            $.extend(itm, itm, reader.itemFunctions);
            that.items[itm.id] = itm;
            if (! itm.marked) {
              that.unread++;
            }
            cursor.continue();
          } 
          else {
            cb();
          }
        };
      }
    };
    return dfd.promise();
  }
}

reader.itemFunctions = {
  markRead: function() {
    if (! this.marked) {
      this.marked = true;
      $("#item-" + this.id).find(".itemTitleUnread").removeClass("itemTitleUnread").addClass("itemTitleRead");
      this.saveToStorage();
      var feed = reader.feedList.feeds[this.feed];
      feed.unread--;
      reader.feedList.updateUnread(feed.url, feed.unread);
      if (feed.folder !== null) {
        var folder = reader.feedList.getFolder(feed.folder); 
        reader.feedList.updateUnread(feed.folder, --folder.unread);
      }
    }
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
    req.onsuccess = function() { 
      //window.console && console.log('successfully wrote item to db'); 
    };
    req.onerror = function() { window.console && console.log('failed to write item to db'); };
  }
}

var reader = {};

reader.db = null;
reader.request = indexedDB.open("BrassReader", 1);
reader.request.onerror = function(event) {
  console.log(event);
};

reader.request.onupgradeneeded = function(event) { 
  console.log("running onupgradeneeded");
   // Update object stores and indices .... 
  var db = event.target.result;
 
  // Create an objectStore to hold feed items. We're
  // going to use "id" as our key path because it should be
  // unique.  id for atom feeds is the GUID supplied
  // by the server and for RSS it is the hashcode of the item
  // collissions will overwrite
  var objectStore = db.createObjectStore("items", { keyPath: "id" });
 
  // Create an index to search items by feed. We will have duplicates
  // so we can't use a unique index.
  objectStore.createIndex("feed", "feed", { unique: false });

  //list of feeds serialized without their items to avoid duplicate storage
  //and writing large structures.  
  objectStore = db.createObjectStore("feeds", { keyPath: "url" });

  //feedList is a single object containing the ordered two level 
  //hierarchical list of feeds displayed in the left pane.
  //since there is only one item in the store, we'll let 
  //the system generate a key
  objectStore = db.createObjectStore("feedlist");
 
};

reader.request.onsuccess = function(event) {
  reader.db = reader.request.result;
  reader.db.onerror = function(event) {
    // Generic error handler for all errors targeted at this database's
    // requests!
    alert("Database error: " + event.target.errorCode);
  };
  
  reader.feedList = new ReaderFeedList();
  reader.feedList.loadFromStorage();
};

reader.showModal = function(options) {
  $("#modalHeader").text(options.header);
  $("#modalLabel").text(options.label);
  $("#btnModalOK").text(options.okButton).unbind("click").click(options.okClick);
  $("#txtModal, #selModal, #fileModal").hide();
  if (options.showText) {
    $("#txtModal").show();
  } else if (options.showFile) {
    $("#fileModal").show();
  } else if (options.showSelect) {
    $("#selModal").show();
  }
  $("#modalWindow").modal("show");
  if ("text" in options) {
    $("#txtModal").val(options.text);
  } else {
    $("#txtModal").val("");
  }
  $("#modalWindow").on('shown', function() { 
    if (options.showText) {
      $("#txtModal").focus().select();
    } else if (options.showFile) {
      $("#fileModal").focus();
    } else if (options.showSelect) {
      $("#selModal").focus();
    }
  });
};

reader.handlers = {
  addFeed: function addFeed(event) {
    $("#modalWindow").modal("hide");
    var newFeed = $("#txtModal").val();
    reader.feedList.addFeed(newFeed);
  },
  addFolder: function addFolder(event) {
    $("#modalWindow").modal("hide");
    var newFolder = $("#txtModal").val();
    reader.feedList.addFolder(newFolder);
  },
  renameFolder: function (oldFolderName) {
    reader.showModal({
      header: "Rename Folder", 
      label: "New Folder Name:", 
      okButton: "Save Changes",
      okClick: function() {
        reader.feedList.renameFolder(oldFolderName, $("#txtModal").val());
        $("#modalWindow").modal("hide");
      },
      showText: true
    });
  },
  renameFeed: function (feedUrl) {
    reader.showModal({
      header: "Rename Feed", 
      label: "New Feed Name:", 
      okButton: "Save Changes",
      text: reader.feedList.feeds[feedUrl].title,
      okClick: function() {
        reader.feedList.renameFeed(feedUrl, $("#txtModal").val());
        $("#modalWindow").modal("hide");
      },
      showText: true
    });
  },
  moveToFolder: function (url) {
    reader.showModal({
      header: "Move to Folder", 
      label: "Select Folder:", 
      okButton: "Move",
      okClick: function() {
        reader.feedList.moveToFolder(url, $("#selModal").val());
        $("#modalWindow").modal("hide");
      },
      showSelect: true});
    $("#selModal").empty();
    $("#selModal").append('<option value="">&lt;&lt; Top &gt;&gt;</option>');
    $.each(reader.feedList.getFolders(), function(i, val) {
      $("#selModal").append('<option value="' + val + '">' + val + '</option>');
    });
  },
  importOpml: function importOpml(event) {
    $("#modalWindow").modal("hide");
    freader = new FileReader();
    freader.onload = function(e) {
      opml = $.parseXML(e.target.result);
      //reader.opml = opml;
      reader.feedList.loadFromOPML(opml);
    }
    freader.readAsText($("#fileModal").get()[0].files[0]);
  },
  sort: function (event) {
    var order = 1;
    if (event.target.id === "btnSortByOldest")
      order = -1;
    reader.feedList.sort(reader.feedList.activeFeed, order);
  }
};

$(document).ready(function() {
  $("#btnAddFeed").click(function() { 
    reader.showModal({
      header: "Add Feed", 
      label: "Past feed URL here", 
      okButton: "Save Changes",
      okClick: reader.handlers.addFeed,
      showText: true});
  });

  $("#btnAddFolder").click(function() { 
    reader.showModal({
      header: "Add Folder", 
      label: "Enter new folder name", 
      okButton: "Save Changes",
      okClick: reader.handlers.addFolder,
      showText: true});
  });

  $("#btnImportOpml").click(function() { 
    reader.showModal({
      header: "Import OPML", 
      label: "Select File", 
      okButton: "Import",
      okClick: reader.handlers.importOpml,
      showFile: true});
  });

  $("#btnRefresh").click(function() { reader.feedList.refresh(); });
  $("#btnClearDB").click(function() { 
    indexedDB.deleteDatabase("BrassReader");
    reader.feedList = new ReaderFeedList();
    reader.feedList.displayList();
  });
  $("#btnSortByNewest, #btnSortByOldest").click(reader.handlers.sort);
  $("#btnViewList").click(function() {
    reader.feedList.isExpandedView = false;
    reader.feedList.refresh();
  });
  $("#btnViewExpanded").click(function() {
    reader.feedList.isExpandedView = true;
    reader.feedList.refresh();
  });
  // Fluid layout doesn't seem to support 100% height; manually set it
  $(window).resize(function() {
    var h = $(window).height() - $("#top-nav").height();
    $('#left-section, #right-section').height(h);  
  });
  $(".right-section").scroll(function() { 
    reader.feedList.elementWatcher.recalculateLocation(); 
    $.each(reader.feedList.expandedWatchers, function(i, val) {
      val.recalculateLocation();
    });
    scrollMonitor.update(); 
  });
  $(window).resize();
  $("#btnMarkAllRead").click(function() { reader.feedList.markAllRead(); });
  $("#mnuAllItems, #mnuUnreadItems").click(function(event) {
    reader.feedList.isShowReadItems = !reader.feedList.isShowReadItems;
    reader.feedList.refresh();
    reader.feedList.saveToStorage();
    $("#btnShowReadItems").html(event.target.innerText + ' <span class="icon-caret-down"></span>');
  });
});



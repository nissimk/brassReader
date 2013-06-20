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

reader.handlers = {
  addFeed: function addFeed(event) {
    $("#modalAddFeed").modal("hide");
    var newFeed = $("#txtNewFeed").val();
    reader.feedList.addFeed(newFeed);
  },
  addFolder: function addFolder(event) {
    $("#modalAddFolder").modal("hide");
    var newFolder = $("#txtNewFolder").val();
    reader.feedList.addFolder(newFolder);
  },
  renameFolder: function (oldFolderName) {
    $("#modalRenameFolder").modal("show");
    $("#btnRenameFolder").unbind("click").click(function(event) {
      reader.feedList.renameFolder(oldFolderName, $("#txtRenameFolder").val());
      $("#modalRenameFolder").modal("hide");
    });
  },
  moveToFolder: function (url) {
    $("#modalMoveToFolder").modal("show");
    $("#selNewFolder").empty();
    $("#selNewFolder").append('<option value="">&lt;&lt; Top &gt;&gt;</option>');
    $.each(reader.feedList.getFolders(), function(i, val) {
      $("#selNewFolder").append('<option value="' + val + '">' + val + '</option>');
    });
    $("#btnMoveToFolder").unbind("click").click(function(event) {
      reader.feedList.moveToFolder(url, $("#selNewFolder").val());
      $("#modalMoveToFolder").modal("hide");
    });
  },
  importOpml: function importOpml(event) {
    $("#modalImportOpml").modal("hide");
    freader = new FileReader();
    freader.onload = function(e) {
      opml = $.parseXML(e.target.result);
      //reader.opml = opml;
      reader.feedList.loadFromOPML(opml);
    }
    freader.readAsText($("#txtOpmlFile").get()[0].files[0]);
  }
};

$(document).ready(function() {
  $("#btnSaveFeed").click(reader.handlers.addFeed);
  $("#btnSaveFolder").click(reader.handlers.addFolder);
  $("#btnImportOpml").click(reader.handlers.importOpml);
  $("#btnImportGReader").click(function() { reader.feedList.importGReader(); });
  $("#btnRefresh").click(function() { reader.feedList.refresh(); });
  $("#btnClearDB").click(function() { 
    indexedDB.deleteDatabase("BrassReader");
    reader.feedList = new ReaderFeedList();
    reader.feedList.displayList();
  });
  // Fluid layout doesn't seem to support 100% height; manually set it
  $(window).resize(function() {
    var h = $(window).height() - $("#top-nav").height();
    $('#left-section, #right-section').height(h);  
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


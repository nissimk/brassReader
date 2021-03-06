/* 
   This is where the html that is injected by javascript is stored.
   some of it is text resources some is html and some is javascript 
   functions that return html
   had to stop using underscore templates because of chrome CSP.
*/

reader.templates = {
  newUserMessage:   //displayed in the items list when there are no subscriptions
    '<tr><td><div class="well"><h4>Welcome to Brass Reader.  ' +
    'Use the buttons on the left to start adding subsctiptions ' +
    'or import from Google Reader or OPML.</h4></div></td></tr>',

  btnShowReadItemsCaption: function(isShowReadItems) {
    return (isShowReadItems ? "All" : "Unread") + 
            '  items <span class="icon-caret-down"></span>'; 
  },
  feedItemInTree: function(id, title, unread) {
    return '<li id="' + id + '"><a class="tree-item" href="#">' + 
           '<span id="' + id + '-name">' + title + '</span>' +
           '<span id="' + id + '-unread"> ( ' +  unread + ' )</span></a></li>'; 
  },
  folderItemInTree: function(id, folderName, unread) {
    return '<li id="' +  id + '"><a class="tree-item" href="#">' +
           '<i class="icon-folder-close"></i><span id="' + id + '-name">' +
           folderName + '</span><span id="' + id + '-unread"> ( ' +
           unread + ' )</span></a></li><ul class="nav nav-list" id="sub' + 
           id + '"></ul>'; 
  },
  folderCaret: function(isOpen) {
    return '<div class="divlink"><i class="icon-caret-' +
           (isOpen ? "down" : "right") +
           ' folder-open-close"></i></div>'; 
  },
  folderDropdownTrigger: function(i) {
    return '<div class="divlink pull-left dropdown-toggle folder-dropdown"' +
           ' data-toggle="dropdown" data-target="#" id="folderMenu-' + i + '">' + 
           '<i class="icon-caret-down"></i></div>';
  },
  feedDropdownTrigger: function(i) {
    return '<div class="divlink pull-left dropdown-toggle folder-dropdown"' +
           ' data-toggle="dropdown" data-target="#" id="feedMenu-' + i + '">' + 
           '<i class="icon-caret-down"></i></div>';
  },
  folderDropdownButton: '<a class="btn dropdown-toggle" data-toggle="dropdown" ' +
                            'data-target="#" id="btnFolderDrop">Folder Options ' +
                          '<span class="icon-caret-down"></span></a>',
  feedDropdownButton: '<a class="btn dropdown-toggle" data-toggle="dropdown" ' +
                            'data-target="#" id="btnFeedDrop">Feed Options ' +
                          '<span class="icon-caret-down"></span></a>',
  itemRowOpen: function(colspan, link, title, description) {
    return '<tr class="openItemRow"><td colspan=' + colspan + ' class="openItemCell">' +
           '<div class="itemContent"><h4><a href="' + link + '">' + title + '</a></h4>' + 
           description + '</div></td></tr>';
  },
  itemRowClosed: function(itemId) { return '<tr class="item" id="item-' + itemId +'"></tr>'; },
  feedTitleCell: function(title) { return '<td class="itemFeedName">' + title+ '</td>'; },
  feedDescCell: function(title, titleClass, shortDesc) {
    return '<td class="itemTitleDesc"><div class="' + titleClass + '">' + 
           title + '</div><span class="shortDesc"> - ' + shortDesc + '</div></td>'; 
  },
  feedTimeCell: function(dt) { return '<td class="itemDateTime">' + dt + '</td>'; }
  
}

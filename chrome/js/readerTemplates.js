/* 
   This is where the html that is injected by javascript is stored.
   some of it is text resources some is html and some is underscore 
   html templates.
*/

reader.templates = {
  newUserMessage:   //displayed in the items list when there are no subscriptions
    '<tr><td><div class="well"><h4>Welcome to Brass Reader.  ' +
    'Use the buttons on the left to start adding subsctiptions ' +
    'or import from Google Reader or OPML.</h4></div></td></tr>',

  btnShowReadItemsCaption: _.template(
    '<% (isShowReadItems ? "All" : "Unread") %>  items <span class="icon-caret-down"></span>'),
  
  feedItemInTree: _.template('<li id="<%= id %>"><a class="tree-item" href="#"><%= title %>' + 
                             '<span id="<%= id %>-unread"> ( <%= unread %> )</span></a></li>'),
  
  folderItemInTree: _.template('<li id="<%= id %>"><a class="tree-item" href="#">' +
                               '<i class="icon-folder-close"></i><span id="<%= id %>-name">' +
                               '<%= folderName %></span>' +
                               '<span id="<%= id %>-unread"> (<%= unread %>)</span>' +
                               '</a></li><ul class="nav nav-list" id="sub<%= id %>"></ul>'),
  
  folderCaret: _.template('<div class="divlink"><i class="icon-caret-<%= isOpen ? "down" : "right"%> ' +
                          'folder-open-close"></i></div>'),

  folderDropdownTrigger: _.template('<div class="divlink pull-left dropdown-toggle folder-dropdown"' +
                                    ' data-toggle="dropdown" data-target="#" id="folderMenu-<%= i %>">' + 
                                    '<i class="icon-caret-down"></i></div>'),
  
  itemRowOpen: _.template('<tr class="openItemRow"><td colspan=<%= colspan %> class="openItemCell">' +
                          '<div class="itemContent"><h4><a href="<%= link %>"><%= title %></a></h4>' + 
                          '<%= description %></div></td></tr>'),

  itemRowClosed: _.template('<tr class="item" id="item-<%= itemId %>"></tr>'),
  feedTitleCell: _.template('<td class="itemFeedName"><%= title %></td>'),
  feedDescCell: _.template('<td class="itemTitleDesc"><div class="<%= titleClass %>">' + 
                           '<%= title %></div><span class="shortDesc"> - <%= shortDesc %></div></td>'),
  feedTimeCell: _.template( '<td class="itemDateTime"><%= dt %></td>')
  
}

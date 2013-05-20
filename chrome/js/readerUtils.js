// from http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
String.prototype.hashCode = function() {
  var hash = 0;
  if (this.length == 0) return hash;
  for (i = 0; i < this.length; i++) {
    char = this.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

Date.prototype.isToday = function() {
  return this.toLocaleDateString() === new Date().toLocaleDateString();
}

Date.prototype.toDateOrTimeStr = function() {
  if (this.isToday()){
    var dt = this.toLocaleTimeString();
    return dt.slice(0, -6) + dt.slice(-3); 
  } else
    return this.toLocaleDateString();
}

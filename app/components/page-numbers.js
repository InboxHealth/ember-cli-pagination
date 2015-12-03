import Ember from 'ember';
import Util from 'ember-cli-pagination/util';
import PageItems from 'ember-cli-pagination/lib/page-items';
import Validate from 'ember-cli-pagination/validate';

export default Ember.Component.extend({
  currentPageBinding: "content.page",
  perPageBinding: "content.perPage",
  totalPagesBinding: "content.totalPages",

  isVisible: function () {
    return this.get('totalPages') > 1;
  }.property('totalPages'),

  hasPages: Ember.computed.gt('totalPages', 1),

  watchInvalidPage: function() {
    var me = this;
    var c = this.get('content');
    if (c && c.on) {
      c.on('invalidPage', function(e) {
        me.sendAction('invalidPageAction',e);
      });
    }
  }.observes("content"),

  truncatePages: true,

  numPagesToShow: function(){
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if(w<=500){
      return 5;
    }else{
      return 10;
    }
  }.property(),

  adjustNumPagesToShow: function(){
    var that = this;
    Ember.$(window).resize(function(){
      Ember.run(function(){
        that.notifyPropertyChange('numPagesToShow');
      })
    });
  }.on('didInsertElement'),

  validate: function() {
    if (Util.isBlank(this.get('currentPage'))) {
      Validate.internalError("no currentPage for page-numbers");
    }
    if (Util.isBlank(this.get('totalPages'))) {
      Validate.internalError('no totalPages for page-numbers');
    }
  },

  pageItemsObj: function() {
    return PageItems.create({
      parent: this,
      currentPageBinding: "parent.currentPage",
      totalPagesBinding: "parent.totalPages",
      truncatePagesBinding: "parent.truncatePages",
      numPagesToShowBinding: "parent.numPagesToShow",
      showFLBinding: "parent.showFL"
    });
  }.property(),

  pageItems: function() {
    this.validate();
    return this.get("pageItemsObj.pageItems");
  }.property("pageItemsObj.pageItems","pageItemsObj"),

  canStepForward: (function() {
    var page = Number(this.get("currentPage"));
    var totalPages = Number(this.get("totalPages"));
    return page < totalPages;
  }).property("currentPage", "totalPages"),

  canStepBackward: (function() {
    var page = Number(this.get("currentPage"));
    return page > 1;
  }).property("currentPage"),

  actions: {
    preventLinkDefault: function(){
      // action made so event.preventDefault() gets called when clicking link
    },
    pageClicked: function(number) {
      Util.log("PageNumbers#pageClicked number " + number);
      this.set("currentPage", number);
      this.sendAction('action', number, this.get('perPage'));
    },
    incrementPage: function(num) {
      var currentPage = Number(this.get("currentPage")),
          totalPages = Number(this.get("totalPages"));

      if(currentPage === totalPages && num === 1) { return false; }
      if(currentPage <= 1 && num === -1) { return false; }
      this.incrementProperty('currentPage', num);

      this.sendAction('action', this.get('currentPage'), this.get('perPage'));
    }
  }
});

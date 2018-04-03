import Ember from 'ember';
import Util from 'ember-cli-pagination/util';
import PageItems from 'ember-cli-pagination/lib/page-items';
import Validate from 'ember-cli-pagination/validate';

export default Ember.Component.extend({
  currentPageBinding: "content.page",
  totalPagesBinding: "content.totalPages",

  isVisible: Ember.computed('totalPages', function (){
    return this.get('totalPages') > 1;
  }),

  hasPages: Ember.computed.gt('totalPages', 1),

  watchInvalidPage: Ember.observer('content', function() {
    var me = this;
    var c = this.get('content');
    if (c && c.on) {
      c.on('invalidPage', function(e) {
        me.sendAction('invalidPageAction',e);
      });
    }
  }),

  truncatePages: true,

  numPagesToShow: Ember.computed(function(){
    var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    if(w<=500){
      return 5;
    }else{
      return 10;
    }
  }),

  notifyNumPagesToShow(){
    Ember.run(() => {
      this.notifyPropertyChange('numPagesToShow');
    })
  },

  didInsertElement(){
    this._super(...arguments);
    this.set('resizeHandler', this.notifyNumPagesToShow.bind(this));
    Ember.$(window).resize(this.get('resizeHandler'));
  },

  willDestroyElement(){
    this._super(...arguments);
    Ember.$(window).off('resize', this.get('resizeHandler'));
  },

  validate() {
    if (Util.isBlank(this.get('currentPage'))) {
      Validate.internalError("no currentPage for page-numbers");
    }
    if (Util.isBlank(this.get('totalPages'))) {
      Validate.internalError('no totalPages for page-numbers');
    }
  },

  pageItemsObj: Ember.computed(function() {
    return PageItems.create({
      parent: this,
      currentPageBinding: "parent.currentPage",
      totalPagesBinding: "parent.totalPages",
      truncatePagesBinding: "parent.truncatePages",
      numPagesToShowBinding: "parent.numPagesToShow",
      showFLBinding: "parent.showFL"
    });
  }),

  pageItems: Ember.computed('pageItemsObj.pageItems', 'pageItemsObj', function() {
    this.validate();
    return this.get("pageItemsObj.pageItems");
  }),

  canStepForward: Ember.computed("currentPage", "totalPages", function() {
    var page = Number(this.get("currentPage"));
    var totalPages = Number(this.get("totalPages"));
    return page < totalPages;
  }),

  canStepBackward: Ember.computed('currentPage', function() {
    var page = Number(this.get("currentPage"));
    return page > 1;
  }),

  actions: {
    preventLinkDefault(){
      // action made so event.preventDefault() gets called when clicking link
    },
    pageClicked(number) {
      Util.log("PageNumbers#pageClicked number " + number);
      this.set("currentPage", number);
      this.sendAction('action',number);
    },
    incrementPage(num) {
      var currentPage = Number(this.get("currentPage")),
          totalPages = Number(this.get("totalPages"));

      if(currentPage === totalPages && num === 1) { return false; }
      if(currentPage <= 1 && num === -1) { return false; }
      this.incrementProperty('currentPage', num);

      var newPage = this.get('currentPage');
      this.sendAction('action',newPage);
    }
  }
});

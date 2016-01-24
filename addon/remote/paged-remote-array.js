import Ember from 'ember';
import Util from 'ember-cli-pagination/util';
import LockToRange from 'ember-cli-pagination/watch/lock-to-range';
import { QueryParamsForBackend, ChangeMeta } from './mapping';
import PageMixin from '../page-mixin';
import DS from 'ember-data';
import EmberDataHelpersMixin from 'ember-cli-pagination/ember-data-helpers';
import {
  serializerForAdapter
} from "ember-data/-private/system/store/serializers";
import {
  _bind,
  _guard,
  _objectIsAlive
} from "ember-data/-private/system/store/common";

var ArrayProxyPromiseMixin = Ember.Mixin.create(Ember.PromiseProxyMixin, {
  then: function(success,failure) {
    var promise = this.get('promise');
    var me = this;

    promise.then(function() {
      success(me);
    }, failure);
  }
});

export default Ember.ArrayProxy.extend(PageMixin, Ember.Evented, ArrayProxyPromiseMixin, EmberDataHelpersMixin, {
  page: 1,
  loading: false,
  paramMapping: function() {
    return {};
  }.property(''),

  init: function() {
    var initCallback = this.get('initCallback');
    if (initCallback) {
      initCallback(this);
    }

    try {
      this.get('promise');
    }
    catch (e) {
      this.set('promise', this.fetchContent());
    }
  },

  addParamMapping: function(key,mappedKey,mappingFunc) {
    var paramMapping = this.get('paramMapping') || {};
    if (mappingFunc) {
      paramMapping[key] = [mappedKey,mappingFunc];
    }
    else {
      paramMapping[key] = mappedKey;
    }
    this.set('paramMapping',paramMapping);
    this.incrementProperty('paramsForBackendCounter');
      //this.pageChanged();
  },

  addQueryParamMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  addMetaResponseMapping: function(key,mappedKey,mappingFunc) {
    return this.addParamMapping(key,mappedKey,mappingFunc);
  },

  paramsForBackend: function() {
    var paramsObj = QueryParamsForBackend.create({page: this.getPage(),
                                                  perPage: this.getPerPage(),
                                                  paramMapping: this.get('paramMapping')});
    var ops = paramsObj.make();

    // take the otherParams hash and add the values at the same level as page/perPage
    ops = Util.mergeHashes(ops,this.get('otherParams')||{});

    return ops;
  }.property('page','perPage','paramMapping','paramsForBackendCounter'),

  rawFindFromStore: function() {
    var store = this.get('store');
    var modelName = this.get('modelName');
    var parentRecordType = this.get('parentRecordType');
    var parentRecordId = this.get('parentRecordId');
    var ops = this.get('paramsForBackend');
    var res;
    var url;
    var modelPath;
    var IHPromise;

    if( Ember.isEmpty(parentRecordType) || Ember.isEmpty(parentRecordId) ) {
        res = store.query(modelName, ops);
    }
    else {
        var type = store.modelFor(modelName);
        var adapter = store.adapterFor(modelName);
        var recordArray = store.recordArrayManager.createAdapterPopulatedRecordArray(type, ops);
        var serializer = serializerForAdapter(store, adapter, modelName);
        var label = "DS: PagedRemoteArray Query on hasManyLinks for" + modelName;
        modelPath = store.adapterFor(parentRecordType).pathForType(modelName);
        url = store.adapterFor(parentRecordType).buildURL(parentRecordType, parentRecordId) + '/' + modelPath;
        IHPromise = adapter.ajax(url, 'GET', { data: ops });
        IHPromise = Ember.RSVP.Promise.resolve(IHPromise, label);
        IHPromise = _guard(IHPromise, _bind(_objectIsAlive, store));
        IHPromise = this.IHReturnPromise(IHPromise, serializer, type, recordArray, store);
        var promiseArray = DS.PromiseArray.create({
          promise: Ember.RSVP.Promise.resolve(IHPromise, label)
        });
        res = promiseArray;
    }
    return res;
  },

  fetchContent: function() {
    this.set("loading",true);
    var res = this.rawFindFromStore();
    this.incrementProperty("numRemoteCalls");
    var me = this;

    res.then(function(rows) {
      var metaObj = ChangeMeta.create({paramMapping: me.get('paramMapping'),
                                       meta: rows.meta,
                                       page: me.getPage(),
                                       perPage: me.getPerPage()});
      me.set("loading",false);
      return me.set("meta", metaObj.make());
    }, function(error) {
      me.set('loading', false);
      Util.log("PagedRemoteArray#fetchContent error " + error);
      me.set("loading",false);
    });

    return res;
  },

  totalPagesBinding: "meta.total_pages",

  pageChanged: function() {
    var page = this.get('page');
    var lastPage = this.get('lastPage');
    if (lastPage != page) {
      this.set('lastPage', page);
      this.set("promise", this.fetchContent());
    }
  }.observes("page", "perPage"),

  lockToRange: function() {
    LockToRange.watch(this);
  },

  watchPage: function() {
    var page = this.get('page');
    var totalPages = this.get('totalPages');
    if (parseInt(totalPages) <= 0) {
      return;
    }

    this.trigger('pageChanged',page);

    if (page < 1 || page > totalPages) {
      this.trigger('invalidPage',{page: page, totalPages: totalPages, array: this});
    }
  }.observes('page','totalPages'),

  setOtherParam: function(k,v) {
    if (!this.get('otherParams')) {
      this.set('otherParams',{});
    }

    this.get('otherParams')[k] = v;
    this.incrementProperty('paramsForBackendCounter');
    Ember.run.once(this,"pageChanged");
  }
});

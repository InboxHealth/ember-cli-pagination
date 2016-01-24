import Ember from 'ember';
import DS from 'ember-data';
import { assert } from "ember-data/-private/debug";
import {
  normalizeResponseHelper
} from "ember-data/-private/system/store/serializer-response";

export default Ember.Mixin.create({

IHReturnPromise: function(promise, serializer, typeClass, recordArray, store) {
  return promise.then(function(adapterPayload) {
    var records, payload;
    store._adapterRun(function() {
      payload = normalizeResponseHelper(serializer, store, typeClass, adapterPayload, null, 'query');
      //TODO Optimize
      records = store.push(payload);
    });

    assert('The response to store.query is expected to be an array but it was a single record. Please wrap your response in an array or use `store.queryRecord` to query for a single record.', Ember.isArray(records));
    recordArray.loadRecords(records, payload);
    return recordArray;

  }, null, "DS: Extract payload of query " + typeClass);
}

});


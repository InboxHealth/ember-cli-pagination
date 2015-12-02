import Ember from 'ember';
import DS from 'ember-data';

export default Ember.Mixin.create({

IHSerializerForAdapter: function(adapter, type, store) {
      var serializer = adapter.serializer;

      if (serializer === undefined) {
        serializer = store.serializerFor(type);
      }

      if (serializer === null || serializer === undefined) {
        serializer = {
          extract: function(store, type, payload) { return payload; }
        };
      }

      return serializer;
},

_IHObjectIsAlive: function(object) {
      return !(Ember.get(object, "isDestroyed") || Ember.get(object, "isDestroying"));
},

_IHGuard: function(promise, test) {
      var guarded = promise['finally'](function() {
        if (!test()) {
          guarded._subscribers.length = 0;
        }
      });

      return guarded;
},

_IHBind: function(fn) {
      var args = Array.prototype.slice.call(arguments, 1);

      return function() {
        return fn.apply(undefined, args);
      };
},


IHReturnPromise: function(promise, serializer, typeClass, recordArray, store) {
  return promise.then(function(adapterPayload) {
      var records;
      store._adapterRun(function() {
        var payload = normalizeResponseHelper(serializer, store, typeClass, adapterPayload, null, 'query');
        //TODO Optimize
        records = store.push(payload);
      });

      Ember.assert('The response to store.query is expected to be an array but it was a single record. Please wrap your response in an array or use `store.queryRecord` to query for a single record.', Ember.isArray(records));
      recordArray.loadRecords(records);
      return recordArray;
  }, null, "DS: Extract payload of query " + typeClass);
}

});

function normalizeResponseHelper(serializer, store, modelClass, payload, id, requestType) {
  let normalizedResponse = serializer.normalizeResponse(store, modelClass, payload, id, requestType);
  let validationErrors = [];
  Ember.runInDebug(() => {
    validationErrors = validateDocumentStructure(normalizedResponse);
  });
  Ember.assert(`normalizeResponse must return a valid JSON API document:\n\t* ${validationErrors.join('\n\t* ')}`, Ember.isEmpty(validationErrors));
  // TODO: Remove after metadata refactor
  if (normalizedResponse.meta) {
    store._setMetadataFor(modelClass.modelName, normalizedResponse.meta);
  }

  return normalizedResponse;
}

function validateDocumentStructure(doc) {
  let errors = [];
  if (!doc || typeof doc !== 'object') {
    errors.push('Top level of a JSON API document must be an object');
  } else {
    if (!('data' in doc) &&
        !('errors' in doc) &&
        !('meta' in doc)) {
      errors.push('One or more of the following keys must be present: "data", "errors", "meta".');
    } else {
      if (('data' in doc) && ('errors' in doc)) {
        errors.push('Top level keys "errors" and "data" cannot both be present in a JSON API document');
      }
    }
    if ('data' in doc) {
      if (!(doc.data === null || Ember.isArray(doc.data) || typeof doc.data === 'object')) {
        errors.push('data must be null, an object, or an array');
      }
    }
    if ('meta' in doc) {
      if (typeof doc.meta !== 'object') {
        errors.push('meta must be an object');
      }
    }
    if ('errors' in doc) {
      if (!Ember.isArray(doc.errors)) {
        errors.push('errors must be an array');
      }
    }
    if ('links' in doc) {
      if (typeof doc.links !== 'object') {
        errors.push('links must be an object');
      }
    }
    if ('jsonapi' in doc) {
      if (typeof doc.jsonapi !== 'object') {
        errors.push('jsonapi must be an object');
      }
    }
    if ('included' in doc) {
      if (typeof doc.included !== 'object') {
        errors.push('included must be an array');
      }
    }
  }

  return errors;
}

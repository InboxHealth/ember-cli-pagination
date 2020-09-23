import Ember from 'ember';
import DS from 'ember-data';

export default Ember.Mixin.create({

IHSerializerForAdapter: function(adapter, type, store) {
      var serializer = adapter.serializer;

      if (serializer === undefined) {
        serializer = store.serializerFor(type);
      }

      if (serializer === null || serializer === undefined) {
        Ember.deprecate('Ember Data 2.0 will no longer support adapters with a null serializer property. Please define `defaultSerializer: "-default"` your adapter and make sure the `serializer` property is not null.');
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


IHReturnPromise: function(promise, serializer, type, recordArray, store, existingRecords=[]) {
  return promise.then(function(adapterPayload) {
      var records;
      store._adapterRun(function() {
        var requestType = Ember.get(serializer, 'isNewSerializerAPI') ? 'query' : 'findQuery';
        var payload = normalizeResponseHelper(serializer, store, type, adapterPayload, null, requestType);
        //TODO Optimize
        records = pushPayload(store, payload);
      });

      if(!Ember.isEmpty(existingRecords)){
        records = existingRecords.concat(records);
      }

      recordArray.loadRecords(records);
      return recordArray;
  }, null, "DS: Extract payload of findQuery " + type);
}

});

function normalizeResponseHelper(serializer, store, modelClass, payload, id, requestType) {
  if (serializer.get('isNewSerializerAPI')) {
    var normalizedResponse = serializer.normalizeResponse(store, modelClass, payload, id, requestType);
    if (normalizedResponse.meta) {
      store._setMetadataFor(modelClass.modelName, normalizedResponse.meta);
    }
    return normalizedResponse;
  } else {
    Ember.deprecate('Your custom serializer uses the old version of the Serializer API, with `extract` hooks. Please upgrade your serializers to the new Serializer API using `normalizeResponse` hooks instead.');
    var serializerPayload = serializer.extract(store, modelClass, payload, id, requestType);
    return _normalizeSerializerPayload(modelClass, serializerPayload);
  }
}

function _normalizeSerializerPayload(modelClass, payload) {
  var data = null;

  if (payload) {
    if (Ember.typeOf(payload) === 'array') {
      data = payload.map(function(payload) { return _normalizeSerializerPayloadItem(modelClass, payload) });
    } else {
      data = _normalizeSerializerPayloadItem(modelClass, payload);
    }
  }

  return { data };
}

function _normalizeSerializerPayloadItem(modelClass, itemPayload) {
  var item = {};

  item.id = '' + itemPayload.id;
  item.type = modelClass.modelName;
  item.attributes = {};
  item.relationships = {};

  modelClass.eachAttribute(function(name) {
    if (itemPayload.hasOwnProperty(name)) {
      item.attributes[name] = itemPayload[name];
    }
  });

  modelClass.eachRelationship(function(key, relationshipMeta) {
    var relationship, value;

    if (itemPayload.hasOwnProperty(key)) {
      relationship = {};
      value = itemPayload[key];

      if (relationshipMeta.kind === 'belongsTo') {
        relationship.data = normalizeRelationshipData(key, value, relationshipMeta);
        //handle the belongsTo polymorphic case, where { post:1, postType: 'video' }
        if (relationshipMeta.options && relationshipMeta.options.polymorphic && itemPayload[key + 'Type']) {
          relationship.data.type = itemPayload[key + 'Type'];
        }
      } else if (relationshipMeta.kind === 'hasMany') {
        //|| [] because the hasMany could be === null
        Ember.assert("A " + relationshipMeta.parentType + "record was pushed into the store with the value of " + key + " being " + Ember.inspect(value) + ", but " + key + " is a hasMany relationship so the value must be an array. You should probably check your data payload or serializer.", Ember.isArray(value) || value === null);

        relationship.data = (value || []).map(function(item) { return normalizeRelationshipData(key, item, relationshipMeta) });
      }
    }

    if (itemPayload.links && itemPayload.links.hasOwnProperty(key)) {
      relationship = relationship || {};
      value = itemPayload.links[key];

      relationship.links = {
        related: value
      };
    }

    if (relationship) {
      relationship.meta = Ember.get(itemPayload, "meta." + key);
      item.relationships[key] = relationship;
    }
  });

  return item;
}

function normalizeRelationshipData(key, value, relationshipMeta) {
  if (Ember.isNone(value)) {
    return null;
  }
  //Temporary support for https://github.com/emberjs/data/issues/3271
  if (value instanceof Model) {
    value = { id: value.id, type: value.constructor.modelName };
  }
  if (Ember.typeOf(value) === 'object') {
    Ember.assert("Ember Data expected a number or string to represent the record(s) in the " + key + " relationship instead it found an object. If this is a polymorphic relationship please specify a 'type' key. If this is an embedded relationship please include the 'DS.EmbeddedRecordsMixin' and specify the " + key + " property in your serializer's attrs object.", value.type);
    if (value.id) {
      value.id = "'" + value.id + "'";
    }
    return value;
  }

  Ember.assert("A" + relationshipMeta.parentType + "record was pushed into the store with the value of " + key + "being " + Ember.inspect(value) + ", but " + key + "is a belongsTo relationship so the value must not be an array. You should probably check your data payload or serializer.", !Ember.isArray(value));
  return { id: "'" + value + "'", type: relationshipMeta.type };
}


function pushPayload(store, payload) {
  var result = pushPayloadData(store, payload);
  pushPayloadIncluded(store, payload);
  return result;
}

function pushPayloadData(store, payload) {
  var result;
  if (payload && payload.data) {
    if (Array.isArray(payload.data)) {
      result = payload.data.map(function(item) {  return _pushResourceObject(store, item) });
    } else {
      result = _pushResourceObject(store, payload.data);
    }
  }
  return result;
}

function pushPayloadIncluded(store, payload) {
  var result;
  if (payload && payload.included && Array.isArray(payload.included)) {
    result = payload.included.map(function(item) { return _pushResourceObject(store, item) });
  }
  return result;
}

function _pushResourceObject(store, resourceObject) {
  return store.push({ data: resourceObject });
}

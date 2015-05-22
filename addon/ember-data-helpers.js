import Ember from 'ember';
import DS from 'ember-data';

export default Ember.Mixin.create({

IHAjax: function(adapter, url, type, options) {
        return new Ember.RSVP.Promise(function(resolve, reject) {
          var hash = adapter.ajaxOptions(url, type, options);

          hash.success = function(json, textStatus, jqXHR) {
            json = adapter.ajaxSuccess(jqXHR, json);
            if (json instanceof DS.InvalidError) {
              Ember.run(null, reject, json);
            } else {
              Ember.run(null, resolve, json);
            }
          };

          hash.error = function(jqXHR) {
            Ember.run(null, reject, adapter.ajaxError(jqXHR, jqXHR.responseText));
          };

          Ember.$.ajax(hash);
        }, "DS: RESTAdapter#ajax " + type + " to " + url);
},


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

IHGetJSON: function(adapter, url, type, query) {
        return this.IHAjax(adapter, url, type, { data: query });
},

IHReturnPromise: function(promise, serializer, type, recordArray, store) {
  return promise.then(function(adapterPayload) {
        var payload;
        store._adapterRun(function() {
          payload = serializer.extract(store, type, adapterPayload, null, 'findQuery');

          Ember.assert("The response from a findQuery must be an Array, not " + Ember.inspect(payload), Ember.typeOf(payload) === 'array');
        });

        recordArray.load(payload);
        return recordArray;
  }, null, "DS: Extract payload of findQuery " + type);
}

});

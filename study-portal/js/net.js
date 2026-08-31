/* Study Portal — room networking.

   There is no game server to pay for: peers meet on a free public MQTT
   broker and relay small JSON messages through two topics.
     .../h  host  -> everyone   (world snapshots)
     .../c  client -> host      (inputs, joins, skill picks)

   The first character of a room code says which broker the room lives on,
   so a shared link always lands everyone on the same relay. */
(function (SA) {
  'use strict';

  var BROKERS = [
    { letter: 'A', url: 'wss://broker.emqx.io:8084/mqtt', name: 'relay 1' },
    { letter: 'B', url: 'wss://broker.hivemq.com:8884/mqtt', name: 'relay 2' },
    { letter: 'C', url: 'wss://test.mosquitto.org:8081/mqtt', name: 'relay 3' }
  ];
  var TOPIC_ROOT = 'studyportal/arena3/';
  var LIB_SOURCES = [
    'js/vendor/mqtt.min.js',
    'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js',
    'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'
  ];

  var libPromise = null;
  function loadLib() {
    if (window.mqtt) return Promise.resolve(window.mqtt);
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      var i = 0;
      (function next() {
        if (i >= LIB_SOURCES.length) return reject(new Error('Could not load the networking library.'));
        var s = document.createElement('script');
        s.src = LIB_SOURCES[i++];
        s.onload = function () { window.mqtt ? resolve(window.mqtt) : next(); };
        s.onerror = next;
        document.head.appendChild(s);
      })();
    });
    return libPromise;
  }

  function brokerForCode(code) {
    var letter = (code || '').charAt(0).toUpperCase();
    for (var i = 0; i < BROKERS.length; i++) if (BROKERS[i].letter === letter) return BROKERS[i];
    return BROKERS[0];
  }

  function connectBroker(mqtt, broker, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var client = mqtt.connect(broker.url, {
        clientId: 'sp_' + SA.uid(),
        keepalive: 30,
        connectTimeout: timeoutMs || 9000,
        reconnectPeriod: 3000,
        clean: true
      });
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { client.end(true); } catch (e) {}
        reject(new Error('timeout'));
      }, (timeoutMs || 9000) + 1500);
      client.on('connect', function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(client);
      });
      client.on('error', function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { client.end(true); } catch (e) {}
        reject(err);
      });
    });
  }

  /* ------------------------------------------------------------------ Relay */
  function Relay() {
    this.client = null;
    this.code = null;
    this.isHost = false;
    this.broker = null;
    this.onMsg = null;
    this.onStatus = null;
    this.connected = false;
    this.sentBytes = 0;
    this.recvBytes = 0;
  }

  Relay.prototype.status = function (state, text) {
    if (this.onStatus) this.onStatus(state, text);
  };

  /* Host: try brokers in order and keep the first one that answers.
     Client: use exactly the broker the room code points at. */
  Relay.prototype.start = function (opts) {
    var self = this;
    this.isHost = !!opts.isHost;
    this.onMsg = opts.onMsg;
    this.onStatus = opts.onStatus;

    return loadLib().then(function (mqtt) {
      var order = self.isHost ? BROKERS.slice() : [brokerForCode(opts.code)];
      if (opts.brokerIndex != null && BROKERS[opts.brokerIndex]) order = [BROKERS[opts.brokerIndex]];

      var lastErr = null;
      function attempt(i) {
        if (i >= order.length) throw (lastErr || new Error('No relay could be reached.'));
        var b = order[i];
        self.status('connecting', 'Connecting to ' + b.name + '…');
        return connectBroker(mqtt, b, 9000).then(function (client) {
          self.client = client;
          self.broker = b;
          return b;
        }).catch(function (e) {
          lastErr = e;
          return attempt(i + 1);
        });
      }

      return attempt(0).then(function (broker) {
        self.code = self.isHost ? (broker.letter + (opts.code || SA.roomCode()).slice(1)) : opts.code;
        var base = TOPIC_ROOT + self.code + '/';
        self.pubTopic = base + (self.isHost ? 'h' : 'c');
        self.subTopic = base + (self.isHost ? 'c' : 'h');
        self.connected = true;

        self.client.on('message', function (topic, payload) {
          self.recvBytes += payload.length;
          var text = payload.toString();
          var msg;
          try { msg = JSON.parse(text); } catch (e) { return; }
          if (self.onMsg) self.onMsg(msg);
        });
        self.client.on('close', function () {
          if (!self.connected) return;
          self.status('reconnecting', 'Relay dropped — reconnecting…');
        });
        self.client.on('reconnect', function () { self.status('reconnecting', 'Reconnecting…'); });
        self.client.on('connect', function () {
          if (self.connected) self.status('online', 'Connected');
        });

        return new Promise(function (resolve, reject) {
          self.client.subscribe(self.subTopic, { qos: 0 }, function (err) {
            if (err) return reject(err);
            self.status('online', 'Connected via ' + broker.name);
            resolve(self.code);
          });
        });
      });
    });
  };

  Relay.prototype.pub = function (obj) {
    if (!this.client || !this.connected) return;
    var text = JSON.stringify(obj);
    this.sentBytes += text.length;
    try { this.client.publish(this.pubTopic, text, { qos: 0 }); } catch (e) { /* dropped frame */ }
  };

  /* end(false) lets the last "I'm leaving" frame reach the broker before the
     socket closes; the forced close is only a safety net. */
  Relay.prototype.stop = function () {
    this.connected = false;
    var client = this.client;
    this.client = null;
    if (!client) return;
    try {
      client.end(false);
      setTimeout(function () { try { client.end(true); } catch (e) {} }, 1200);
    } catch (e) {
      try { client.end(true); } catch (e2) {}
    }
  };

  SA.Relay = Relay;
  SA.BROKERS = BROKERS;
  SA.brokerForCode = brokerForCode;
  SA.newRoomCode = function () {
    /* letter is replaced once we know which relay accepted the host */
    return BROKERS[0].letter + SA.roomCode().slice(1);
  };

})(window.SA);

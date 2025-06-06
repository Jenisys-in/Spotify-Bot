//  Hide webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => false });

//  Mock Chrome
window.chrome = {
  runtime: {
    connect: () => {},
    sendMessage: () => {},
    PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
    PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
    PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
    RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' }
  },
  loadTimes: () => ({ firstPaintTime: 0, firstPaintAfterLoadTime: 0 }),
  csi: () => ({ startE: Date.now(), onloadT: Date.now() + 100, pageT: 10000, tran: 15 }),
  app: {
    isInstalled: false,
    getDetails: () => {},
    getIsInstalled: () => false,
    runningState: () => 'cannot_run'
  }
};

//  Language
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

//  Plugins - Fix PluginArray issue
const createPluginArray = () => {
  // Create plugins
  const chromePDF = Object.create(Plugin.prototype);
  Object.defineProperties(chromePDF, {
    name: { value: 'Chrome PDF Plugin', enumerable: true },
    description: { value: 'Portable Document Format', enumerable: true },
    filename: { value: 'internal-pdf-viewer', enumerable: true },
    version: { value: '', enumerable: true },
    length: { value: 1, enumerable: true }
  });
  
  const chromeViewer = Object.create(Plugin.prototype);
  Object.defineProperties(chromeViewer, {
    name: { value: 'Chrome PDF Viewer', enumerable: true },
    description: { value: 'Chrome PDF Viewer', enumerable: true },
    filename: { value: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', enumerable: true },
    version: { value: '', enumerable: true },
    length: { value: 1, enumerable: true }
  });
  
  const nativeClient = Object.create(Plugin.prototype);
  Object.defineProperties(nativeClient, {
    name: { value: 'Native Client', enumerable: true },
    description: { value: '', enumerable: true },
    filename: { value: 'internal-nacl-plugin', enumerable: true },
    version: { value: '', enumerable: true },
    length: { value: 2, enumerable: true }
  });

  // Create a proper PluginArray
  const plugins = Object.create(PluginArray.prototype);
  Object.defineProperties(plugins, {
    length: { value: 3, enumerable: true },
    0: { value: chromePDF, enumerable: true },
    1: { value: chromeViewer, enumerable: true },
    2: { value: nativeClient, enumerable: true }
  });
  
  // Add methods
  plugins.item = function(index) { return this[index] || null; };
  plugins.namedItem = function(name) {
    for (let i = 0; i < this.length; i++) {
      if (this[i].name === name) return this[i];
    }
    return null;
  };
  plugins.refresh = function() {};
  
  return plugins;
};

// Replace the navigator.plugins property
Object.defineProperty(navigator, 'plugins', {
  get: () => createPluginArray(),
  enumerable: true,
  configurable: true
});

//  Permissions spoof
const originalQuery = navigator.permissions.query;
navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission })
    : originalQuery(parameters);

//  Audio fingerprint spoof
const originalGetChannelData = AudioBuffer.prototype.getChannelData;
AudioBuffer.prototype.getChannelData = function () {
  const results = originalGetChannelData.apply(this, arguments);
  const rand = Math.random() * 0.0000001;
  for (let i = 0; i < results.length; i += 100) {
    results[i] = results[i] + rand;
  }
  return results;
};

//  Canvas fingerprint spoof - With more consistent modifications
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (...args) {
  const context = getContext.apply(this, args);
  if (context && args[0] === '2d') {
    const getImageData = context.getImageData;
    context.getImageData = function (x, y, w, h) {
      const imageData = getImageData.apply(this, [x, y, w, h]);
      const noise = Math.floor(Math.random() * 10) % 2; // Consistent noise pattern
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] ^= noise;
        imageData.data[i + 1] ^= noise;
        imageData.data[i + 2] ^= noise;
      }
      return imageData;
    };
    
    // Fix for fillText and strokeText methods
    const originalFillText = context.fillText;
    context.fillText = function (...args) {
      const result = originalFillText.apply(this, args);
      return result;
    };
    
    const originalStrokeText = context.strokeText;
    context.strokeText = function (...args) {
      const result = originalStrokeText.apply(this, args);
      return result;
    };
  }
  return context;
};

//  WebGL spoofing - Fix vendor issue
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  // Fix the vendor issue specifically
  if (parameter === 37445) return "Intel Inc."; // UNMASKED_VENDOR_WEBGL - changed from Google Inc.
  if (parameter === 37446) return "Intel Iris OpenGL Engine"; // UNMASKED_RENDERER_WEBGL
  if (parameter === 7936) return "WebKit"; // VENDOR (different from UNMASKED_VENDOR_WEBGL)
  if (parameter === 7937) return "WebKit WebGL"; // RENDERER (different from UNMASKED_RENDERER_WEBGL)
  if (parameter === 3415) return 0; // MAX_VERTEX_UNIFORM_VECTORS
  if (parameter === 3414) return 0; // MAX_FRAGMENT_UNIFORM_VECTORS
  if (parameter === 35661) return 32; // MAX_VERTEX_TEXTURE_IMAGE_UNITS
  if (parameter === 34921) return 16; // MAX_VARYING_VECTORS
  if (parameter === 36347) return 1; // MAX_TEXTURE_MAX_ANISOTROPY_EXT
  if (parameter === 34047) return [0, 0, 0, 0]; // ALIASED_LINE_WIDTH_RANGE
  return getParameter.apply(this, arguments);
};

// Also apply the same fix to WebGL2RenderingContext if available
if (window.WebGL2RenderingContext) {
  const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return "Intel Inc."; // UNMASKED_VENDOR_WEBGL
    if (parameter === 37446) return "Intel Iris OpenGL Engine"; // UNMASKED_RENDERER_WEBGL
    if (parameter === 7936) return "WebKit"; // VENDOR
    if (parameter === 7937) return "WebKit WebGL"; // RENDERER
    return getParameter2.apply(this, arguments);
  };
}

//  Function.toString() clean patch
const oldToString = Function.prototype.toString;
Function.prototype.toString = function () {
  const fnStr = oldToString.call(this);
  if (fnStr.includes('[native code]')) return fnStr;
  if (this === navigator.permissions.query) return "function query() { [native code] }";
  if (this === AudioBuffer.prototype.getChannelData) return "function getChannelData() { [native code] }";
  if (this === HTMLCanvasElement.prototype.getContext) return "function getContext() { [native code] }";
  if (this === WebGLRenderingContext.prototype.getParameter) return "function getParameter() { [native code] }";
  if (this === WebGL2RenderingContext?.prototype.getParameter) return "function getParameter() { [native code] }";
  if (this === navigator.mediaDevices?.enumerateDevices) return "function enumerateDevices() { [native code] }";
  return fnStr;
};

//  Remove CDP fingerprints
for (let key of Object.keys(window)) {
  if (key.startsWith('cdc_') || key.match(/puppeteer/i)) {
    try { delete window[key]; } catch (e) {}
  }
}

//  Device specs spoofing
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

//  WebRTC protection (most important for browserleaks.com/webrtc)
const originalRTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
if (originalRTCPeerConnection) {
  window.RTCPeerConnection = function(...args) {
    const pc = new originalRTCPeerConnection(...args);
    
    // Override createDataChannel
    const origCreateDataChannel = pc.createDataChannel;
    pc.createDataChannel = function() {
      return origCreateDataChannel.apply(this, arguments);
    };
    
    // Override createOffer
    const origCreateOffer = pc.createOffer;
    pc.createOffer = function() {
      return origCreateOffer.apply(this, arguments);
    };
    
    // Handle onicecandidate to prevent IP leaks
    const origSetIceCandidate = pc.setLocalDescription;
    pc.setLocalDescription = function() {
      const onIceCandidate = pc.onicecandidate;
      
      // Override the onicecandidate to filter out IP addresses
      if (onIceCandidate || this.onicecandidate) {
        pc.onicecandidate = function(event) {
          if (event && event.candidate && event.candidate.candidate) {
            // Filter out the IP address by modifying the candidate string
            const newCandidate = event.candidate;
            newCandidate.candidate = newCandidate.candidate.replace(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/g, '192.168.1.1');
            
            // Create a new RTCIceCandidate
            const modifiedCandidate = new RTCIceCandidate(newCandidate);
            const newEvent = new Event('icecandidate');
            newEvent.candidate = modifiedCandidate;
            
            // Call original handler with modified event
            if (onIceCandidate) onIceCandidate(newEvent);
          }
        };
      }
      
      return origSetIceCandidate.apply(this, arguments);
    };
    
    return pc;
  };
  
  // Mirror properties/prototypes to make it look genuine
  window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
  window.RTCPeerConnection.generateCertificate = originalRTCPeerConnection.generateCertificate;
}

//  mediaDevices.enumerateDevices with realistic values
if (navigator.mediaDevices?.enumerateDevices) {
  const originalEnum = navigator.mediaDevices.enumerateDevices;
  navigator.mediaDevices.enumerateDevices = async () => {
    return [
      { kind: 'audioinput', deviceId: 'default', groupId: 'default', label: '', toJSON: () => {} },
      { kind: 'audioinput', deviceId: 'communications', groupId: 'default', label: '', toJSON: () => {} },
      { kind: 'audiooutput', deviceId: 'default', groupId: 'default', label: '', toJSON: () => {} },
      { kind: 'audiooutput', deviceId: 'communications', groupId: 'default', label: '', toJSON: () => {} },
      { kind: 'videoinput', deviceId: 'default', groupId: 'default', label: '', toJSON: () => {} }
    ];
  };
}

//  Make console.debug look normal
console.debug = (msg) => {
  console.log("[debug]", msg);
};

//  Fix browser behavior detection
const originalHasOwnProperty = Object.prototype.hasOwnProperty;
Object.prototype.hasOwnProperty = function(property) {
  // Handle known evasion tests
  if (this === navigator && (property === 'webdriver' || property === 'domAutomation')) {
    return false;
  }
  return originalHasOwnProperty.call(this, property);
};

//  Fix iframe window relationships for iframe-based detection
if (window !== window.top) {
  try {
    // Make iframe window.parent and window.top access look normal
    Object.defineProperty(window, 'parent', {
      get: function() { return window.top; }
    });
  } catch (e) {}
}

//  Fix screen properties
Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight });
Object.defineProperty(screen, 'availWidth', { get: () => screen.width });
Object.defineProperty(screen, 'availHeight', { get: () => screen.height });
Object.defineProperty(screen, 'availLeft', { get: () => 0 });
Object.defineProperty(screen, 'availTop', { get: () => 0 });

//  Fix for document.hidden and document.visibilityState
Object.defineProperty(document, 'hidden', { get: () => false });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });

//  Fix for Date.prototype.getTimezoneOffset
const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
Date.prototype.getTimezoneOffset = function() {
  return -240; // Consistent timezone offset (EST, -4 hours)
};

// Enhanced WebRTC Protection Implementation for Multiple Proxies

// Use the previously declared originalRTCPeerConnection

if (originalRTCPeerConnection) {
  // Complete replacement of RTCPeerConnection
  window.RTCPeerConnection = function(...args) {
    const pc = new originalRTCPeerConnection(...args);
    
    // Block all ice candidates completely
    const origAddEventListener = pc.addEventListener;
    pc.addEventListener = function(type, listener, options) {
      if (type === 'icecandidate') {
        const wrappedListener = function(e) {
          // Always send null candidate to prevent any IP leakage
          const modifiedEvent = new Event('icecandidate');
          modifiedEvent.candidate = null;
          listener(modifiedEvent);
          return;
        };
        return origAddEventListener.call(this, type, wrappedListener, options);
      }
      return origAddEventListener.call(this, type, listener, options);
    };
    
    // Override onicecandidate to ensure complete IP protection
    Object.defineProperty(pc, 'onicecandidate', {
      get() {
        return this._onicecandidate;
      },
      set(cb) {
        this._onicecandidate = (event) => {
          // Always call with null candidate
          const nullEvent = {
            ...event,
            candidate: null
          };
          cb(nullEvent);
        };
      }
    });
    
    // Override createOffer method
    const originalCreateOffer = pc.createOffer.bind(pc);
    pc.createOffer = function(options) {
      return originalCreateOffer(options)
        .then(offer => {
          // Remove all candidates and connection info from SDP
          offer.sdp = offer.sdp
            .replace(/a=candidate:.*\r\n/g, '')
            .replace(/a=extmap:.*\r\n/g, '')
            .replace(/a=sendrecv\r\n/g, 'a=inactive\r\n');
          return offer;
        });
    };
    
    // Override createAnswer method
    const originalCreateAnswer = pc.createAnswer.bind(pc);
    pc.createAnswer = function(options) {
      return originalCreateAnswer(options)
        .then(answer => {
          // Remove all candidates and connection info from SDP
          answer.sdp = answer.sdp
            .replace(/a=candidate:.*\r\n/g, '')
            .replace(/a=extmap:.*\r\n/g, '')
            .replace(/a=sendrecv\r\n/g, 'a=inactive\r\n');
          return answer;
        });
    };
    
    // Override setLocalDescription
    const originalSetLocalDescription = pc.setLocalDescription.bind(pc);
    pc.setLocalDescription = function(sessionDescription) {
      if (sessionDescription && sessionDescription.sdp) {
        sessionDescription.sdp = sessionDescription.sdp
          .replace(/a=candidate:.*\r\n/g, '')
          .replace(/a=extmap:.*\r\n/g, '')
          .replace(/a=sendrecv\r\n/g, 'a=inactive\r\n');
      }
      return originalSetLocalDescription(sessionDescription);
    };
    
    // Override setRemoteDescription
    const originalSetRemoteDescription = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = function(sessionDescription) {
      if (sessionDescription && sessionDescription.sdp) {
        sessionDescription.sdp = sessionDescription.sdp
          .replace(/a=candidate:.*\r\n/g, '')
          .replace(/a=extmap:.*\r\n/g, '')
          .replace(/a=sendrecv\r\n/g, 'a=inactive\r\n');
      }
      return originalSetRemoteDescription(sessionDescription);
    };
    
    // Override addIceCandidate to block all candidates
    const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
    pc.addIceCandidate = function(candidate) {
      return Promise.resolve(); // Don't actually add any candidates
    };
    
    return pc;
  };
  
  // Preserve the prototype chain
  window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
  
  // Copy static methods and properties
  if (originalRTCPeerConnection.generateCertificate) {
    window.RTCPeerConnection.generateCertificate = originalRTCPeerConnection.generateCertificate;
  }
}

// Additional WebRTC protection - dynamically handle WebRTC tests
// This will make tests that check WebRTC vs Remote IP matching pass
// by completely disabling actual WebRTC connections
if (window.RTCPeerConnection) {
  const originalConstructor = window.RTCPeerConnection;
  window.RTCPeerConnection = function(...args) {
    // Force empty configuration that won't establish connections
    if (args[0] && args[0].iceServers) {
      args[0].iceServers = []; // Disable all ICE servers
    }
    
    // Additional options to prevent leaks
    if (args[0]) {
      args[0].iceCandidatePoolSize = 0;
      args[0].bundlePolicy = 'max-bundle';
      args[0].rtcpMuxPolicy = 'require';
    }
    
    const pc = new originalConstructor(...args);
    
    // Override getStats to prevent any stats collection
    const originalGetStats = pc.getStats;
    pc.getStats = function() {
      return Promise.resolve(new Map()); // Return empty stats
    };
    
    return pc;
  };
  
  // Preserve prototype and properties
  window.RTCPeerConnection.prototype = originalConstructor.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, originalConstructor);
}

// Complete blocking of media devices enumeration
if (navigator.mediaDevices) {
  navigator.mediaDevices.enumerateDevices = async function() {
    return []; // Return empty array
  };
  
  navigator.mediaDevices.getUserMedia = function() {
    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  };
  
  navigator.mediaDevices.getDisplayMedia = function() {
    return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  };
}

// Complete disabling of WebRTC by intercepting all possible entry points
// This is the most aggressive approach and should work for any proxy setup
(function() {
  // Add additional protection - override global objects
  if (window.RTCDataChannel) {
    window.RTCDataChannel.prototype.send = function() {
      return; // Block all data sending
    };
  }
  
  // Firefox-specific
  if (window.mozRTCPeerConnection) {
    window.mozRTCPeerConnection = window.RTCPeerConnection;
  }
  
  // Define a dummy implementation for any newer WebRTC APIs
  if (!window.RTCIceTransport) {
    window.RTCIceTransport = class {
      constructor() {}
      getSelectedCandidatePair() { return null; }
    };
  }
  
  // Monitor and kill any attempts to create data channels
  const originalCreateDataChannel = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function() {
    // Return a dummy object that does nothing
    return {
      send: function() {},
      close: function() {},
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
  };
})();

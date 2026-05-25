const Plugin = {
  install(Vue) {
    Vue.registerElement('WebViewX', () => require('../').WebViewX);
  },
};

export default Plugin;

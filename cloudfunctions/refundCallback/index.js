const cloud = require('wx-server-sdk');
const { dispatch } = require('./lib/shared/dispatch');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// T00 骨架：尚未开放任何业务操作，也不读写数据。
const actions = Object.freeze({});

exports.main = async (event, context) => dispatch(actions, event, context);

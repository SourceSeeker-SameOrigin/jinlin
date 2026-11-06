Component({
  properties: { couponOptions: { type: Array, value: [] }, couponsEnabled: { type: Boolean, value: false },
    pointsEnabled: { type: Boolean, value: false }, pointsBalance: { type: Number, value: 0 }, pointsToUse: { type: Number, value: 0 } },
  methods: {
    coupon(event) {
      const option = this.data.options[Number(event.detail.value)];
      this.triggerEvent('couponchange', { value: option.value });
    },
    points(event) { this.triggerEvent('pointschange', { value: event.detail.value }); }
  },
  observers: {
    'couponOptions': function (options) {
      this.setData({ options: [{ label: '自动选择最优惠', value: '__auto' }, { label: '不使用优惠券', value: '' },
        ...(options || []).map(item => ({ label: item.label, value: item.couponId }))] });
    }
  },
  data: { options: [{ label: '自动选择最优惠', value: '__auto' }, { label: '不使用优惠券', value: '' }] }
});

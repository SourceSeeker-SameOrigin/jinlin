Component({ properties: { amount: { type: String, value: '--' }, reason: String, disabled: Boolean, loading: Boolean, label: { type: String, value: '确认下单' } }, methods: { submit() { if (!this.data.disabled && !this.data.loading) this.triggerEvent('submit'); } } });


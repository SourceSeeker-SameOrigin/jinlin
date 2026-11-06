Component({ properties: { message: { type: String, value: '暂时没有记录' }, retry: Boolean }, methods: { retry() { this.triggerEvent('retry'); } } });


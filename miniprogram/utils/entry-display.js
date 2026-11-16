// 明文只交给发起读取的当前可见任务。每次刷新、离页或关闭都会使旧读取失效。
function clear(page) {
  page.entryRead = (page.entryRead || 0) + 1;
  page.setData({ entryPassword: '', readingEntry: false });
}
async function reveal(page, read) {
  if (!page.visible || page.data.loading || page.data.readingEntry) return;
  clear(page);
  const token = page.entryRead;
  page.setData({ readingEntry: true, error: '' });
  try {
    const result = await read();
    if (page.visible && token === page.entryRead) page.setData({ entryPassword: result.entry });
  } catch (error) {
    if (page.visible && token === page.entryRead) page.setData({ error: error.message || '门锁信息暂不可用' });
  } finally {
    if (page.visible && token === page.entryRead) page.setData({ readingEntry: false });
  }
}
module.exports = { clear, reveal };

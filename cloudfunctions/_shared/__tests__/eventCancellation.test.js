const { PAGE_SIZE, MAX_ATTEMPTS, retryDelay, taskId } = require('../eventCancellation');

test('活动取消任务分页与重试有界且稳定', () => {
  expect(PAGE_SIZE).toBe(50);
  expect(MAX_ATTEMPTS).toBe(8);
  expect(taskId('signup_1')).toBe('event_cancel_task_signup_1');
  expect(retryDelay(1)).toBe(5 * 60 * 1000);
  expect(retryDelay(2)).toBe(10 * 60 * 1000);
  expect(retryDelay(20)).toBe(6 * 60 * 60 * 1000);
});

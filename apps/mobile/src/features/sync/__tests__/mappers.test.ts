import { fromRemote, toRemote } from '../mappers';

/** A picture path means nothing on another device, so it never leaves this one. */
it('keeps a chat picture’s path on the device', () => {
  const remote = toRemote({
    id: 'm1',
    threadId: 't1',
    body: 'Solve this',
    hasImage: true,
    imageUri: 'file:///page.jpg',
    syncStatus: 'pending',
    createdAt: 0,
  });

  expect(remote).not.toHaveProperty('image_uri');
  expect(remote).not.toHaveProperty('sync_status');
  expect(remote).toMatchObject({ thread_id: 't1', has_image: true });
  expect(remote.created_at).toBe(new Date(0).toISOString());
});

it('reads a row from the server as synced', () => {
  expect(
    fromRemote({ id: 'n1', user_id: 'u', updated_at: new Date(5).toISOString() } as never),
  ).toMatchObject({
    id: 'n1',
    userId: 'u',
    updatedAt: 5,
    syncStatus: 'synced',
  });
});

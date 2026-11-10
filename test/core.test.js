import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { findAutomation } from '../src/match.js';
import { verifySignature } from '../src/signature.js';
import { extractComments, extractMessages } from '../src/payload.js';
import { followGateStep, withButton, fill, MAX_FOLLOW_CHECKS } from '../src/gate.js';

test('follow gate: follower gets the link, non-follower is asked to follow', () => {
  assert.deepEqual(followGateStep({ status: 'awaiting_reply' }, true), { action: 'send_link', status: 'sent' });
  assert.deepEqual(followGateStep({ status: 'awaiting_reply' }, false), { action: 'ask_follow', status: 'awaiting_follow' });
  assert.deepEqual(followGateStep({ status: 'awaiting_follow', followChecks: 1 }, true), { action: 'send_link', status: 'sent' });
});

test('follow gate: stops nagging and ignores finished events', () => {
  assert.equal(followGateStep({ status: 'awaiting_follow', followChecks: MAX_FOLLOW_CHECKS }, false).action, 'none');
  assert.equal(followGateStep({ status: 'sent' }, true).action, 'none');
  assert.equal(followGateStep({ status: 'failed' }, false).action, 'none');
});

test('button message and template fill', () => {
  const m = withButton('hi', 'A very long button label here', 'P');
  assert.equal(m.quick_replies[0].title.length <= 20, true);
  assert.equal(m.quick_replies[0].payload, 'P');
  assert.equal(fill('follow @{username}', { username: 'wallframez' }), 'follow @wallframez');
});

test('webhook payload: messages, quick replies, postbacks; echoes dropped', () => {
  const payload = {
    object: 'instagram',
    entry: [{
      id: '178',
      messaging: [
        { sender: { id: 'U1' }, recipient: { id: '178' }, message: { mid: 'm1', text: 'Send me the link', quick_reply: { payload: 'GET_LINK:e1' } } },
        { sender: { id: '178' }, recipient: { id: 'U1' }, message: { mid: 'm2', text: 'hi', is_echo: true } },
        { sender: { id: 'U2' }, recipient: { id: '178' }, postback: { mid: 'm3', title: 'Go', payload: 'X' } },
      ],
    }],
  };
  assert.deepEqual(extractMessages(payload), [
    { igAccountId: '178', senderId: 'U1', mid: 'm1', text: 'Send me the link', payload: 'GET_LINK:e1' },
    { igAccountId: '178', senderId: 'U2', mid: 'm3', text: 'Go', payload: 'X' },
  ]);
});

test('webhook payload: both Meta shapes give the same comment', () => {
  const value = { id: 'C1', text: 'link', from: { id: 'U9', username: 'fan' }, media: { id: 'M1' } };
  const classic = { object: 'instagram', entry: [{ id: '178', changes: [{ field: 'comments', value }] }] };
  const flat = [{ object: 'instagram', entry: [{ id: '178', field: 'comments', value }] }];
  const expected = [{ igAccountId: '178', value }];
  assert.deepEqual(extractComments(classic), expected);
  assert.deepEqual(extractComments(flat), expected);
  assert.deepEqual(extractComments({ object: 'page', entry: [] }), []);
  assert.deepEqual(extractComments({ object: 'instagram', entry: [{ id: '1', changes: [{ field: 'mentions', value }] }] }), []);
});

const any = { name: 'any', active: true, mediaId: '', keywords: ['link'], matchType: 'contains' };
const post1 = { name: 'post1', active: true, mediaId: 'M1', keywords: ['link'], matchType: 'contains' };
const exact = { name: 'exact', active: true, mediaId: '', keywords: ['guide'], matchType: 'exact' };

test('keyword match is case-insensitive and trims', () => {
  assert.equal(findAutomation([any], { text: '  Send me the LINK pls ', mediaId: 'X' }), any);
});

test('no keyword, no match', () => {
  assert.equal(findAutomation([any], { text: 'nice reel', mediaId: 'X' }), null);
});

test('exact match needs the whole comment', () => {
  assert.equal(findAutomation([exact], { text: 'GUIDE', mediaId: 'X' }), exact);
  assert.equal(findAutomation([exact], { text: 'guide please', mediaId: 'X' }), null);
});

test('post-specific automation beats the any-post one', () => {
  assert.equal(findAutomation([any, post1], { text: 'link', mediaId: 'M1' }), post1);
  assert.equal(findAutomation([any, post1], { text: 'link', mediaId: 'M2' }), any);
});

test('inactive automations are skipped', () => {
  assert.equal(findAutomation([{ ...any, active: false }], { text: 'link', mediaId: 'X' }), null);
});

test('signature: valid, tampered, missing', () => {
  const secret = 's3cret';
  const body = Buffer.from('{"object":"instagram"}');
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifySignature(body, sig, secret), true);
  assert.equal(verifySignature(Buffer.from('{"object":"x"}'), sig, secret), false);
  assert.equal(verifySignature(body, undefined, secret), false);
  assert.equal(verifySignature(body, 'sha256=abc', secret), false);
});

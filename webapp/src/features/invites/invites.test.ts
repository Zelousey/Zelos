import { describe, expect, it } from 'vitest';
import { parseAction } from '../../shell/useInbox';
import { safeLink } from '../../shell/NotificationsSheet';
import { errorText, parseInvite } from './invites';

describe('invites', () => {
  it('reads an invite defensively', () => {
    const inv = parseInvite('Abcdefgh23')({ kind: 'battle', from: 'u1', fromName: 'Ada', fromUsername: 'ada_1', fromPhoto: 'javascript:alert(1)', warId: 'abcdefghjk12', warName: 'Friday', buyIn: 1000, days: 3, status: 'open', expiresAt: 5 });
    expect(inv).toMatchObject({ code: 'Abcdefgh23', kind: 'battle', fromName: 'Ada', fromUsername: 'ada_1', fromPhoto: null, warId: 'abcdefghjk12', buyIn: 1000, status: 'open' });
    expect(parseInvite('x')({ kind: 'squad', from: 'u1', squadId: '../etc', status: 'weird' })).toMatchObject({ squadId: null, status: 'cancelled', fromName: 'A friend' });
    expect(() => parseInvite('x')({ kind: 'prank', from: 'u1' })).toThrow();
    expect(() => parseInvite('x')({ kind: 'join' })).toThrow();
  });
  it('bell actions: only well-formed ones', () => {
    expect(parseAction({ type: 'invite', code: 'Abcdefgh23', kind: 'join' })).toEqual({ type: 'invite', code: 'Abcdefgh23' });
    expect(parseAction({ type: 'tw', id: 'AbCdEf0123456789xyzQ' })).toEqual({ type: 'tw', id: 'AbCdEf0123456789xyzQ' });
    expect(parseAction({ type: 'invite', code: '../x' })).toBeUndefined();
    expect(parseAction({ type: 'delete-account' })).toBeUndefined();
    expect(parseAction(null)).toBeUndefined();
  });
  it('bell links: site paths with or without a slash, app paths stay in the app, nothing else', () => {
    expect(safeLink('practice/war.html?w=abc')).toEqual({ href: '/practice/war.html?w=abc' });
    expect(safeLink('/practice/index.html')).toEqual({ href: '/practice/index.html' });
    expect(safeLink('app/i/Abcdefgh23')).toEqual({ app: '/i/Abcdefgh23' });
    expect(safeLink('//evil.com/x')).toEqual({});
    expect(safeLink('https://evil.com')).toEqual({});
    expect(safeLink('javascript:alert(1)')).toEqual({});
  });
  it('error text: the server message, or a fallback', () => {
    expect(errorText({ message: 'This invite has expired. Ask for a new one.' }, 'x')).toBe('This invite has expired. Ask for a new one.');
    expect(errorText({ message: 'internal' }, 'Try again')).toBe('Try again');
    expect(errorText(null, 'Try again')).toBe('Try again');
  });
});

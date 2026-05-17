// Thin wrapper around the browser Notification API. Used by Dashboard to
// surface new chat messages when the tab is in the background.
//
// Caveat: iOS Safari only supports web notifications when the site is
// installed as a PWA (added to home screen). On a plain web tab the
// Notification global may exist but requestPermission resolves to 'denied'
// or never resolves at all. We treat all failures as "no notification" and
// the in-app cascading unread badges keep working regardless.

import { firstName } from './format';
import type { Profile } from '@/types/db';

export function notificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function notificationsPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/** Request permission once. No-op if already decided. */
export async function requestNotificationPermission(): Promise<void> {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    // Some browsers (notably older Safari) reject the call instead of
    // returning 'denied'. Treat the same as denied.
  }
}

interface ShowMessageNotificationArgs {
  itemLabel: string | undefined;
  author: Profile | undefined;
  content: string;
  /** Used as the notification tag so successive messages for the same
   *  thread collapse into one. */
  itemId: string;
}

export function showMessageNotification(args: ShowMessageNotificationArgs): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const { itemLabel, author, content, itemId } = args;
  const name = author ? firstName(author.display_name, author.email) : 'Someone';
  const title = itemLabel ? `${name} · ${itemLabel}` : name;
  try {
    const n = new Notification(title, {
      body: content.length > 200 ? content.slice(0, 200) + '…' : content,
      tag: itemId,
      icon: '/beach-bg.webp',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some platforms throw if the Notification constructor is restricted.
  }
}

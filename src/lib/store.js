import { BUCKET, isSupabaseConfigured, supabase } from './supabase'
import { collegeEmailError, isCollegeEmail } from './college'

/**
 * Data layer for UniNest.
 *
 * With Supabase configured this talks to Postgres, Storage and Realtime using
 * the signed-in student's session; the database enforces who may read or write
 * what. Without keys it falls back to a browser-local demo account so the
 * prototype can be tried instantly (same function shapes, no network).
 */
export const demoMode = !isSupabaseConfigured

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const FOLDERS = ['Notes', 'Assignments', 'Activity', 'Notices', 'Other']

const JOINED_KEY = 'uninest.joinedGroups'
const DEMO_SESSION_KEY = 'uninest.demo.session'
const DEMO_KEYS = {
  groups: 'uninest.demo.groups',
  messages: 'uninest.demo.messages',
  egg: 'uninest.demo.egg',
  members: 'uninest.demo.members',
}
const DEMO_EVENT = 'uninest:demo-change'
const SIGNED_URL_TTL = 60 * 60
const isBrowser = typeof window !== 'undefined'

function assertCollegeEmail(email) {
  if (!isCollegeEmail(email)) throw new Error(collegeEmailError())
}

/* ------------------------------------------------------------------ helpers */

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

function read(key, fallback) {
  if (!isBrowser) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  if (!isBrowser) return
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new Event(DEMO_EVENT))
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function listJoinedGroups() {
  return read(JOINED_KEY, [])
}

function rememberGroup(group) {
  if (!group) return
  const next = listJoinedGroups().filter((entry) => entry.id !== group.id)
  next.unshift({
    id: group.id,
    name: group.name,
    college: group.college ?? null,
    invite_code: group.invite_code,
  })
  localStorage.setItem(JOINED_KEY, JSON.stringify(next))
}

/* ---------------------------------------------------------- demo account */

export function getDemoSession() {
  return read(DEMO_SESSION_KEY, null)
}

export function signInDemo({ displayName, email }) {
  assertCollegeEmail(email)
  const name = displayName?.trim()
  if (!name) throw new Error('Enter the name your group will see.')
  const existing = getDemoSession()
  const session = {
    userId: existing?.userId || uid(),
    displayName: name,
    email: email?.trim() || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
  }
  write(DEMO_SESSION_KEY, session)
  return session
}

export function updateDemoName(displayName) {
  const name = displayName?.trim()
  if (!name) throw new Error('Enter a name.')
  const current = getDemoSession()
  if (!current) throw new Error('Sign in first.')
  const session = { ...current, displayName: name }
  write(DEMO_SESSION_KEY, session)

  // Keep existing memberships and messages labelled with the new name.
  const members = read(DEMO_KEYS.members, []).map((row) =>
    row.user_id === session.userId ? { ...row, display_name: name } : row,
  )
  localStorage.setItem(DEMO_KEYS.members, JSON.stringify(members))
  return session
}

export function signOutDemo() {
  if (!isBrowser) return
  localStorage.removeItem(DEMO_SESSION_KEY)
  window.dispatchEvent(new Event(DEMO_EVENT))
}

/* -------------------------------------------------------------------- auth */

export async function getInitialSession() {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  return data.session ?? null
}

export function onAuthChange(callback) {
  if (!isSupabaseConfigured) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signUpStudent({ email, password, displayName }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  assertCollegeEmail(email)
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signInStudent({ email, password }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  assertCollegeEmail(email)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signOutStudent() {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function loadProfile(userId) {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function updateDisplayName(userId, displayName) {
  const name = displayName.trim()
  if (!name) throw new Error('Enter a name.')

  if (!isSupabaseConfigured) {
    return { id: 'demo', display_name: updateDemoName(name).displayName }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: name })
    .select('id, display_name')
    .single()
  if (error) throw new Error(error.message)

  // Keep the name shown next to future messages in sync (best effort).
  await supabase.from('group_members').update({ display_name: name }).eq('user_id', userId)

  return data
}

/* ------------------------------------------------------------------ groups */

export async function listGroups() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('list_my_groups')
    if (error) throw new Error(error.message)
    return data || []
  }
  return listJoinedGroups()
}

function rememberDemoMember(groupId, displayName, role = 'member') {
  const session = getDemoSession()
  if (!session) return
  const rows = read(DEMO_KEYS.members, [])
  const next = rows.filter(
    (row) => !(row.group_id === groupId && row.user_id === session.userId),
  )
  next.push({
    group_id: groupId,
    user_id: session.userId,
    display_name: displayName,
    role,
    joined_at: new Date().toISOString(),
  })
  localStorage.setItem(DEMO_KEYS.members, JSON.stringify(next))
}

export async function createGroup({ name, college }) {
  if (!name?.trim()) throw new Error('Give your group a name.')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('create_group', {
      group_name: name.trim(),
      group_college: college?.trim() || null,
    })
    if (error) throw new Error(error.message)
    return data
  }

  const session = getDemoSession()
  const group = {
    id: uid(),
    name: name.trim(),
    college: college?.trim() || null,
    invite_code: makeInviteCode(),
    created_by: session?.userId || null,
    created_at: new Date().toISOString(),
  }
  write(DEMO_KEYS.groups, [group, ...read(DEMO_KEYS.groups, [])])
  rememberGroup(group)
  rememberDemoMember(group.id, session?.displayName || 'Student', 'admin')
  return group
}

export async function joinGroup({ code }) {
  const invite = code.trim().toUpperCase()
  if (!invite) throw new Error('Enter an invite code first.')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('join_group', { code: invite })
    if (error) throw new Error(error.message)
    return data
  }

  const group = read(DEMO_KEYS.groups, []).find((entry) => entry.invite_code === invite) || null
  if (!group) throw new Error('No group found with that invite code. Double-check the code.')
  rememberGroup(group)
  rememberDemoMember(group.id, getDemoSession()?.displayName || 'Student')
  return group
}

export async function getGroup(groupId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }
  return read(DEMO_KEYS.groups, []).find((group) => group.id === groupId) || null
}

export async function listGroupMembers(groupId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, user_id, display_name, role, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
    if (error) throw new Error(error.message)
    return data || []
  }

  const rows = read(DEMO_KEYS.members, []).filter((row) => row.group_id === groupId)
  if (rows.length > 0) return rows

  const session = getDemoSession()
  return session
    ? [
        {
          group_id: groupId,
          user_id: session.userId,
          display_name: session.displayName,
          role: 'admin',
          joined_at: session.createdAt || new Date().toISOString(),
        },
      ]
    : []
}

export async function updateGroupDetails(groupId, { name, college }) {
  if (!name?.trim()) throw new Error('Give the group a name.')

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('update_group_details', {
      target_group: groupId,
      new_name: name.trim(),
      new_college: college?.trim() || null,
    })
    if (error) throw new Error(error.message)
    return data
  }

  const groups = read(DEMO_KEYS.groups, []).map((group) =>
    group.id === groupId
      ? { ...group, name: name.trim(), college: college?.trim() || null }
      : group,
  )
  write(DEMO_KEYS.groups, groups)
  const updated = groups.find((group) => group.id === groupId)
  const joined = listJoinedGroups().map((group) =>
    group.id === groupId
      ? { ...group, name: updated.name, college: updated.college }
      : group,
  )
  localStorage.setItem(JOINED_KEY, JSON.stringify(joined))
  return updated
}

export async function setChatLocked(groupId, locked) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('set_chat_locked', {
      target_group: groupId,
      locked,
    })
    if (error) throw new Error(error.message)
    return data
  }

  write(
    DEMO_KEYS.groups,
    read(DEMO_KEYS.groups, []).map((group) =>
      group.id === groupId ? { ...group, messages_locked: locked } : group,
    ),
  )
  return locked
}

export async function removeGroupMember(groupId, memberId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc('remove_group_member', {
      target_group: groupId,
      target_user: memberId,
    })
    if (error) throw new Error(error.message)
    return
  }

  const rows = read(DEMO_KEYS.members, []).filter(
    (row) => !(row.group_id === groupId && row.user_id === memberId),
  )
  localStorage.setItem(DEMO_KEYS.members, JSON.stringify(rows))
}

export async function rotateInviteCode(groupId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('rotate_invite_code', { target_group: groupId })
    if (error) throw new Error(error.message)
    return data
  }

  const code = makeInviteCode()
  write(
    DEMO_KEYS.groups,
    read(DEMO_KEYS.groups, []).map((group) =>
      group.id === groupId ? { ...group, invite_code: code } : group,
    ),
  )
  const joined = listJoinedGroups().map((group) =>
    group.id === groupId ? { ...group, invite_code: code } : group,
  )
  localStorage.setItem(JOINED_KEY, JSON.stringify(joined))
  return code
}

/* ----------------------------------------------------------------- messages */

export async function listMessages(groupId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (error) throw new Error(error.message)
    return data || []
  }
  return read(DEMO_KEYS.messages, []).filter((message) => message.group_id === groupId)
}

async function uploadChatFile(file, groupId) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Files must be 10 MB or smaller.')
  }

  if (isSupabaseConfigured) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${groupId}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (error) {
      throw new Error(`Upload failed: ${error.message}. Check the "chat-files" bucket and its policies.`)
    }
    return { path, name: file.name, type: file.type || 'application/octet-stream', size: file.size }
  }

  if (file.size > 1_000_000) {
    throw new Error(
      'Demo mode keeps files in the browser, so files must be under 1 MB. Add Supabase keys for bigger uploads.',
    )
  }
  const dataUrl = await readAsDataUrl(file)
  return { path: dataUrl, name: file.name, type: file.type || 'application/octet-stream', size: file.size }
}

export async function sendMessage({ groupId, senderName, body, file }) {
  const attachment = file ? await uploadChatFile(file, groupId) : null
  const row = {
    group_id: groupId,
    sender_name: senderName,
    body: body?.trim() || null,
    file_path: attachment?.path ?? null,
    file_name: attachment?.name ?? null,
    file_type: attachment?.type ?? null,
    file_size: attachment?.size ?? null,
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('messages').insert(row).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  const session = getDemoSession()
  const message = {
    id: uid(),
    ...row,
    sender_id: session?.userId || null,
    created_at: new Date().toISOString(),
  }
  write(DEMO_KEYS.messages, [...read(DEMO_KEYS.messages, []), message])
  return message
}

export function subscribeMessages(groupId, onInsert) {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel(`messages-${groupId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => onInsert(payload.new),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }

  let known = new Set(
    read(DEMO_KEYS.messages, [])
      .filter((message) => message.group_id === groupId)
      .map((message) => message.id),
  )
  const handler = () => {
    const all = read(DEMO_KEYS.messages, []).filter((message) => message.group_id === groupId)
    for (const message of all) {
      if (!known.has(message.id)) {
        known.add(message.id)
        onInsert(message)
      }
    }
  }
  window.addEventListener(DEMO_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(DEMO_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

/**
 * The bucket is private, so files are opened through short-lived signed URLs.
 * Demo-mode paths are data URLs and are returned unchanged.
 */
export async function signFileUrls(paths) {
  const unique = [...new Set((paths || []).filter(Boolean))]
  const map = {}
  if (unique.length === 0) return map

  if (!isSupabaseConfigured) {
    for (const path of unique) map[path] = path
    return map
  }

  const local = unique.filter(
    (path) => path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http'),
  )
  for (const path of local) map[path] = path

  const remote = unique.filter((path) => !local.includes(path))
  if (remote.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(remote, SIGNED_URL_TTL)
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      if (row?.signedUrl) map[row.path] = row.signedUrl
    }
  }

  return map
}

/* ---------------------------------------------------------------- nest egg */

export async function saveToNestEgg({ message, group, folder, title, displayName }) {
  const row = {
    group_id: group?.id ?? message.group_id,
    group_name: group?.name ?? null,
    message_id: message.id,
    folder,
    title: title.trim(),
    body: message.body ?? null,
    file_path: message.file_path ?? null,
    file_name: message.file_name ?? null,
    file_type: message.file_type ?? null,
    saved_by: displayName,
    sender_name: message.sender_name,
    source_created_at: message.created_at,
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('nest_egg_items').insert(row).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  const item = { id: uid(), ...row, created_at: new Date().toISOString() }
  write(DEMO_KEYS.egg, [item, ...read(DEMO_KEYS.egg, [])])
  return item
}

export async function listNestEgg(displayName) {
  if (isSupabaseConfigured) {
    // RLS limits this to the signed-in student's own items.
    const { data, error } = await supabase
      .from('nest_egg_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  }
  return read(DEMO_KEYS.egg, []).filter((item) => item.saved_by === displayName)
}

export async function deleteNestEggItem(itemId) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('nest_egg_items').delete().eq('id', itemId)
    if (error) throw new Error(error.message)
    return
  }
  write(
    DEMO_KEYS.egg,
    read(DEMO_KEYS.egg, []).filter((item) => item.id !== itemId),
  )
}

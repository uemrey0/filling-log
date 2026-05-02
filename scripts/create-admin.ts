import { auth } from '../lib/auth'
import { USERNAME_PATTERN, usernameToManagedEmail } from '../lib/auth-utils'

const username = process.env.ADMIN_USERNAME?.trim().toLowerCase()
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || username

if (!username || !USERNAME_PATTERN.test(username)) {
  throw new Error('ADMIN_USERNAME is required and must be a valid username.')
}

if (!password || password.length < 8) {
  throw new Error('ADMIN_PASSWORD is required and must be at least 8 characters.')
}

await auth.api.createUser({
  body: {
    email: email ?? usernameToManagedEmail(username),
    password,
    name: name ?? username,
    role: 'admin',
    data: {
      username,
      displayUsername: username,
    },
  },
})

console.log(`Admin user created: ${username}`)

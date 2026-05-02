import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { admin, username } from 'better-auth/plugins'
import { db } from './db'
import * as schema from './db/schema'
import { USERNAME_PATTERN } from './auth-utils'
import { sendPasswordSetupEmail } from './mail'

const authSchema = {
  ...schema,
  user: schema.authUsers,
  session: schema.authSessions,
  account: schema.authAccounts,
  verification: schema.authVerifications,
}

export const auth = betterAuth({
  appName: 'FillerLog',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60 * 24,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordSetupEmail({
        to: user.email,
        name: user.name,
        username: (user as typeof user & { username?: string }).username,
        url,
      })
    },
  },
  disabledPaths: ['/sign-up/email', '/sign-in/email', '/is-username-available'],
  telemetry: {
    enabled: false,
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
    }),
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    nextCookies(),
  ],
})

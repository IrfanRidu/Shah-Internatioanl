import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import connectDB from './mongodb';
import User from '@/models/User';
import Role from '@/models/Role';

// For 'editor' / custom-role staff, fetch their assigned Role's permission
// matrix so it can be embedded into the JWT and checked on every request
// without an extra DB round-trip (see lib/permissions.js).
async function attachRolePermissions(userDoc) {
  if (userDoc.role === 'editor' && userDoc.adminRoleId) {
    const roleDoc = await Role.findById(userDoc.adminRoleId).lean();
    return roleDoc?.permissions || {};
  }
  return undefined;
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectDB();
        const user = await User.findOne({ email: credentials.email.toLowerCase() }).select('+password');
        if (!user || !user.password) throw new Error('Invalid credentials');
        const isValid = await user.comparePassword(credentials.password);
        if (!isValid) throw new Error('Invalid credentials');
        if (!user.isActive) throw new Error('Account is deactivated. Contact support.');
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
        const permissions = await attachRolePermissions(user);
        return {
          id: user._id.toString(), name: user.name, email: user.email, role: user.role,
          buyerType: user.buyerType, avatar: user.avatar, phone: user.phone,
          adminRoleId: user.adminRoleId?.toString(), permissions,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await connectDB();
        let existing = await User.findOne({ email: user.email?.toLowerCase() });
        if (!existing) {
          existing = await User.create({
            name: user.name, email: user.email?.toLowerCase(),
            avatar: user.image, provider: 'google', providerId: account.providerAccountId,
            role: 'localBuyer', buyerType: 'local', isActive: true, isEmailVerified: true,
          });
        } else if (!existing.isActive) {
          return false;
        } else {
          await User.findByIdAndUpdate(existing._id, { avatar: user.image, lastLogin: new Date() });
        }
        user.id = existing._id.toString();
        user.role = existing.role;
        user.buyerType = existing.buyerType;
        user.phone = existing.phone;
        user.permissions = await attachRolePermissions(existing);
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.buyerType = user.buyerType;
        token.avatar = user.avatar || user.image;
        token.phone = user.phone;
        token.adminRoleId = user.adminRoleId;
        token.permissions = user.permissions;
      }

      // Fix #42: On EVERY jwt() call (including silent refresh after re-login),
      // re-read the user's role and buyerType from the database.
      // This prevents the "role resets to localBuyer after logout" bug because the
      // DB value (which the admin explicitly set) always overrides what was in the
      // previous JWT token or what the OAuth provider returned.
      if (token.id && !user) {
        // Don't run this on the very first sign-in (user is set then — handled above)
        try {
          await connectDB();
          const freshUser = await User.findById(token.id).select('role buyerType adminRoleId').lean();
          if (freshUser) {
            token.role = freshUser.role;
            token.buyerType = freshUser.buyerType;
            token.adminRoleId = freshUser.adminRoleId?.toString();
          }
        } catch { /* DB unavailable — keep existing token values */ }
      }

      if (trigger === 'update' && session?.refreshPermissions) {
        await connectDB();
        const freshUser = await User.findById(token.id).lean();
        if (freshUser) {
          token.role = freshUser.role;
          token.buyerType = freshUser.buyerType;
          token.adminRoleId = freshUser.adminRoleId?.toString();
          token.permissions = await attachRolePermissions(freshUser);
        }
      } else if (trigger === 'update' && session?.user) {
        // Only allow updating non-role fields from the client
        const { role: _r, adminRoleId: _a, ...safeUpdates } = session.user;
        token = { ...token, ...safeUpdates };
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id || token.sub;
        session.user.role = token.role;
        session.user.buyerType = token.buyerType;
        session.user.avatar = token.avatar;
        session.user.phone = token.phone;
        session.user.adminRoleId = token.adminRoleId;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};

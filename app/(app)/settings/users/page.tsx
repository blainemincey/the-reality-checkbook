import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/guards';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { NewUserForm } from './new-user-form';
import { UserRow } from './user-row';

export default async function UsersSettingsPage() {
  const { user: currentUser } = await requireAdmin();

  const rows = await db.select().from(users).orderBy(asc(users.createdAt));

  return (
    <>
      <header className="mb-8">
        <h1 className="text-lg font-medium">Users</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add household members, change roles, reset passwords. Admins can manage
          users; regular users only see their own ledgers.
        </p>
      </header>

      <section className="mb-8 card p-4">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-text-tertiary">
          Add user
        </h2>
        <NewUserForm />
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wider text-text-tertiary">
          All users ({rows.length})
        </h2>
        <ul className="card divide-y divide-border overflow-hidden">
          {rows.map((u) => (
            <UserRow
              key={u.id}
              user={{
                id: u.id,
                email: u.email,
                role: u.role,
                createdAt: u.createdAt.toISOString(),
              }}
              isSelf={u.id === currentUser.id}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

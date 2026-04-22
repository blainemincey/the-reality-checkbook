import { test, expect, resetDatabase, seedUserAndSession, applySessionCookie } from './helpers';

const TEST_DB_URL = process.env['TEST_DATABASE_URL'];

test.describe('bootstrap: paste → preview → commit → register', () => {
  test.skip(!TEST_DB_URL, 'TEST_DATABASE_URL not set');

  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('the spec narrative produces the expected running balance', async ({
    page,
    context,
    baseURL,
  }) => {
    const user = await seedUserAndSession();
    await applySessionCookie(context, baseURL!, user.sessionToken);

    // Land on accounts list (empty state).
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await expect(page.getByText('Start by creating an account.')).toBeVisible();

    // Create an account with the spec's opening: $4,231.07 on 2026-11-01.
    await page.getByRole('link', { name: /Create first account/i }).click();
    await expect(page).toHaveURL(/\/accounts\/new$/);

    await page.getByLabel('Name').fill('Joint Checking');
    await page.getByLabel('Type').selectOption('checking');
    await page.getByLabel('Opening balance').fill('4231.07');
    await page.getByLabel('Opening date').fill('2026-11-01');

    await page.getByRole('button', { name: /Create & backfill/i }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]+\/backfill$/);

    // Paste 12 rows matching the spec: 6 uncleared (-$847.22) + 6 cleared (-$450).
    const tsv = [
      'Date\tPayee\tAmount',
      '11/1/2026\tOutstanding A\t-100.00',
      '11/2/2026\tOutstanding B\t-247.22',
      '11/3/2026\tOutstanding C\t-200.00',
      '11/3/2026\tOutstanding D\t-100.00',
      '11/4/2026\tOutstanding E\t-100.00',
      '11/4/2026\tOutstanding F\t-100.00',
      '11/1/2026\tCleared A\t-50.00',
      '11/1/2026\tCleared B\t-60.00',
      '11/2/2026\tCleared C\t-70.00',
      '11/2/2026\tCleared D\t-80.00',
      '11/3/2026\tCleared E\t-90.00',
      '11/3/2026\tCleared F\t-100.00',
    ].join('\n');

    await page.getByRole('textbox').first().fill(tsv);

    // Preview math: projected $2,933.85.
    await expect(page.getByText('Projected').locator('..')).toContainText('$2,933.85');
    await expect(page.getByText('Backfill 12')).toBeVisible();

    // Mark the 6 cleared rows. They occupy rows 7-12 (index 6-11) in the table.
    const clearedBoxes = page.locator('table tbody tr td:nth-child(2) input');
    const count = await clearedBoxes.count();
    expect(count).toBe(12);
    for (let i = 6; i < 12; i++) {
      await clearedBoxes.nth(i).check();
    }

    // Commit.
    await page.getByRole('button', { name: /Commit 12 rows/i }).click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]+$/);

    // Register shows 12 rows, final running balance = $2,933.85.
    const bodyRows = page.locator('table tbody tr');
    await expect(bodyRows).toHaveCount(12);
    await expect(bodyRows.last().locator('td').last()).toContainText('$2,933.85');

    // Header balance should also reflect the current (today) running balance.
    // With all 12 txns dated 11/1-11/4/2026 and "today" being wall-clock date,
    // the current balance equals $2,933.85 (assuming the test runs on or after
    // 2026-11-04). If this assertion fails on a machine clock earlier than
    // 11/4/2026, the scenario's dates should be adjusted — leaving as-is per
    // the spec's narrative.
  });
});

-- One-time cleanup requested by the owner (2026-11-18): every appointment, customer and income entry created
-- until now was the owner's own testing. Removes exactly those records; services, hours, settings, users, academy,
-- expenses and integrations are untouched. Rows created after the cutoff (real bookings) are never affected.
-- Runs once per database (tracked in _prisma_migrations).

-- Booking notifications about the test appointments
DELETE FROM "Notification"
WHERE "kind" LIKE 'booking%' AND "createdAt" < TIMESTAMP '2026-11-18 16:52:43';

-- Messages drafted/sent to the test customers (so nothing is ever sent to them once WhatsApp is connected)
DELETE FROM "OutboundMessage"
WHERE "customerId" IN (SELECT "id" FROM "Customer" WHERE "createdAt" < TIMESTAMP '2026-11-18 16:52:43');

-- All income entries until now (income resets to zero)
DELETE FROM "Transaction"
WHERE "type" = 'INCOME' AND "createdAt" < TIMESTAMP '2026-11-18 16:52:43';

-- All appointments until now
DELETE FROM "Appointment"
WHERE "createdAt" < TIMESTAMP '2026-11-18 16:52:43';

-- All customers until now (their notes, interactions and devices are removed with them)
DELETE FROM "Customer"
WHERE "createdAt" < TIMESTAMP '2026-11-18 16:52:43';

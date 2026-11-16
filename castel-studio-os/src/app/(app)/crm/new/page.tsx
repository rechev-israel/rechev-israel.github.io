import { pageGuard } from "@/server/auth/guard";
import { createCustomerAction } from "@/server/actions/crm";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { CustomerFields } from "@/components/crm/customer-fields";
import { Forbidden } from "@/components/forbidden";

export default async function NewCustomerPage() {
  const { t, allowed } = await pageGuard("crm.edit");
  if (!allowed) return <Forbidden message={t.errors.forbidden} />;
  return (
    <>
      <PageHeader title={t.crm.new} />
      <Card className="max-w-3xl">
        <ActionForm action={createCustomerAction}>
          <CustomerFields t={t} />
          <div className="mt-6 flex justify-end"><SubmitButton>{t.common.create}</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}

import { SignUp } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-up/$")({
  component: Page,
});

function Page() {
  return (
    <div className="flex justify-center py-10">
      <SignUp />
    </div>
  );
}

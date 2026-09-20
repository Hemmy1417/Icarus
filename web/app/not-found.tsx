import Link from "next/link";

import { Band, Button } from "@/components/bits";

export default function NotFound() {
  return (
    <Band tone="white">
      <div className="max-w-[640px] pt-6">
        <h1 className="type-heading-lg">Nothing here</h1>
        <p className="mt-6 text-[18px] leading-[1.6] text-steel">
          That address does not name anything on this deployment. It may have been a record on a
          different one.
        </p>
        <div className="mt-10">
          <Link href="/">
            <Button>Back to the start</Button>
          </Link>
        </div>
      </div>
    </Band>
  );
}

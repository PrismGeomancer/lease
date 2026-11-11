import { useState } from 'preact/hooks';
import { Button } from '../components/Button';
import { Stamp } from '../components/Stamp';
import { TriplicateForm } from '../components/TriplicateForm';
import { KeyTag } from '../components/KeyTag';
import { PunchCard } from '../components/PunchCard';
import { Notice } from '../components/Notice';
import { AddressChip, Accordion, Modal, Segmented, Toggle, NumberField } from '../components/misc';
import { toast } from '../lib/toast';
import type { Status } from '../status';

const ALL: Status[] = ['KEPT', 'WATCH', 'BREACHED', 'UNVERIFIABLE', 'PENDING', 'RENEWED', 'EVICTED', 'ACTIVE', 'SAMPLE'];

function Both({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section>
      <h2>{title}</h2>
      <div class="kit-bg-navy"><div class="kit-row">{children}</div></div>
      <div class="kit-bg-paper paper"><div class="kit-row">{children}</div></div>
    </section>
  );
}

export default function Kit() {
  const [open, setOpen] = useState(false);
  const [torn, setTorn] = useState(false);
  const [term, setTerm] = useState(30);
  const [on, setOn] = useState(true);
  const [n, setN] = useState(5);
  return (
    <div class="container">
      <h1>Component kit</h1>
      <Both title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button hold={1200} onComplete={() => toast('Hold complete.')}>Hold</Button>
        <Button href="#/">Link</Button>
      </Both>
      <Both title="Stamps">
        {ALL.map((s) => <Stamp key={s} status={s} />)}
        <Stamp status="KEPT" size="xl" animate />
      </Both>
      <section>
        <h2>Triplicate form</h2>
        <div class="kit-bg-navy">
          <TriplicateForm formNo="FORM L-09 / REV. 3" title="Sample form" torn={torn} labels tilt={-2}>
            <p>Body text on paper.</p>
            <Button size="sm" onPaper variant="secondary" onClick={() => setTorn(!torn)}>Tear</Button>
          </TriplicateForm>
        </div>
      </section>
      <Both title="Key tags">
        <KeyTag index="I" name="Ada Mint" checks="Can anyone still print more?" joke="Infinite supply is just a very fast exit." status="KEPT" source="Solana RPC" />
        <KeyTag index="IV" name="Walter Deed" checks="Top ten?" joke="Ten landlords is a committee." status="PENDING" />
      </Both>
      <Both title="Punch cards">
        <div style={{ width: 360 }}><PunchCard days={30} elapsed={12} /></div>
        <div style={{ width: 360 }}><PunchCard days={14} elapsed={6} breachDay={6} /></div>
        <div style={{ width: 160 }}><PunchCard days={30} elapsed={12} compact /></div>
      </Both>
      <section>
        <h2>Notices</h2>
        <div class="kit-bg-navy kit-row">
          <Notice kind="renewed" ticker="$DRAFTY" date="2026-01-01" />
          <Notice kind="evicted" ticker="$MOTEL" clause="Dev sold 4.1%" date="2026-01-02" />
        </div>
      </section>
      <Both title="Chips and controls">
        <AddressChip address="So11111111111111111111111111111111111111112" label="Mint" link="https://solscan.io/" />
        <Segmented options={[7, 14, 30, 60, 90]} value={term} onChange={setTerm} label="Term" />
        <Toggle checked={on} onChange={setOn} label="Authorities renounced" hint="Mint and freeze authority are null." />
        <NumberField value={n} onChange={setN} min={0.1} max={20} step={0.1} suffix="%" label="Dev max" />
        <Button size="sm" onClick={() => toast('Address copied.')}>Toast</Button>
        <Button size="sm" onClick={() => setOpen(true)}>Modal</Button>
      </Both>
      <section>
        <h2>Accordion</h2>
        <Accordion items={[{ q: 'First?', a: 'Yes.' }, { q: 'Second?', a: 'No.' }]} />
      </section>
      <Modal open={open} onClose={() => setOpen(false)} title="Record this lease on-chain?">
        <p>Body.</p>
        <Button onPaper onClick={() => setOpen(false)}>Close</Button>
      </Modal>
    </div>
  );
}

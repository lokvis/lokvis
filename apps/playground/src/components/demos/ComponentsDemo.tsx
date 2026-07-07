/**
 * Demo: UI Components Showcase(W4.7)
 *
 * 展示 @lokvis/ui-core 的全部组件,供开发时预览设计与暗色模式。
 * 含 Button / Card / Badge / Slider / Toggle / Select / Tabs / Dialog / Tooltip。
 */
import { useState } from 'react';
import {
  Button,
  Card,
  Badge,
  Icon,
  Spinner,
  EmptyState,
  Slider,
  Toggle,
  Select,
  Tabs,
  Dialog,
  Tooltip,
} from '@lokvis/ui-core';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLang } from '@/i18n/useLang';
import { useTranslations } from '@/i18n/utils';

export default function ComponentsDemo() {
  return (
    <ErrorBoundary>
      <ComponentsDemoContent />
    </ErrorBoundary>
  );
}

function ComponentsDemoContent() {
  const lang = useLang();
  const t = useTranslations(lang);
  const [sliderVal, setSliderVal] = useState(50);
  const [toggleOn, setToggleOn] = useState(true);
  const [selectVal, setSelectVal] = useState('png');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{t('components.title')}</h1>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Button */}
          <Section title={t('components.button')}>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">{t('components.btnPrimary')}</Button>
              <Button variant="secondary">{t('components.btnSecondary')}</Button>
              <Button variant="ghost">{t('components.btnGhost')}</Button>
              <Button variant="danger">{t('components.btnDanger')}</Button>
              <Button loading>{t('components.btnLoading')}</Button>
              <Button disabled>{t('components.btnDisabled')}</Button>
              <Button size="sm">{t('components.btnSmall')}</Button>
              <Button size="lg">{t('components.btnLarge')}</Button>
            </div>
          </Section>

          {/* Badge */}
          <Section title={t('components.badge')}>
            <div className="flex flex-wrap gap-2">
              <Badge>{t('components.badgeDefault')}</Badge>
              <Badge variant="success">{t('components.badgeSuccess')}</Badge>
              <Badge variant="warning">{t('components.badgeWarning')}</Badge>
              <Badge variant="danger">{t('components.badgeDanger')}</Badge>
              <Badge variant="info">{t('components.badgeInfo')}</Badge>
            </div>
          </Section>

          {/* Card */}
          <Section title={t('components.card')}>
            <Card hoverable className="lokvis-ui-card">
              <h3 className="mb-1 font-semibold text-zinc-100">{t('components.cardTitle')}</h3>
              <p className="text-sm text-zinc-400">
                {t('components.cardContent')}
              </p>
            </Card>
          </Section>

          {/* Slider */}
          <Section title={t('components.slider')}>
            <div className="max-w-sm space-y-3">
              <Slider value={sliderVal} onValueChange={setSliderVal} showValue />
              <Slider value={sliderVal} onValueChange={setSliderVal} showValue format={(v) => `${v}%`} />
            </div>
          </Section>

          {/* Toggle */}
          <Section title={t('components.toggle')}>
            <div className="space-y-3">
              <Toggle checked={toggleOn} onChange={setToggleOn} label={t('components.featureFlag')} />
              <Toggle defaultChecked label={t('components.defaultOn')} />
              <Toggle size="sm" label={t('components.smallSize')} />
              <Toggle disabled label={t('components.toggleDisabled')} />
            </div>
          </Section>

          {/* Select */}
          <Section title={t('components.select')}>
            <Select
              className="lokvis-ui-select"
              value={selectVal}
              onChange={setSelectVal}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPEG' },
                { value: 'webp', label: 'WebP' },
                { value: 'avif', label: 'AVIF' },
              ]}
            />
          </Section>

          {/* Tabs */}
          <Section title={t('components.tabs')}>
            <Tabs
              items={[
                { value: 'overview', label: t('components.tabOverview') },
                { value: 'params', label: t('components.tabParams') },
                { value: 'history', label: t('components.tabHistory') },
              ]}
            >
              {(active) => (
                <div className="text-sm text-zinc-400">
                  {active === 'overview' && t('components.tabOverviewContent')}
                  {active === 'params' && t('components.tabParamsContent')}
                  {active === 'history' && t('components.tabHistoryContent')}
                </div>
              )}
            </Tabs>
          </Section>

          {/* Dialog */}
          <Section title={t('components.dialog')}>
            <Button onClick={() => setDialogOpen(true)}>{t('components.openDialog')}</Button>
            <Dialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              title={t('components.confirmTitle')}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button variant="primary" onClick={() => setDialogOpen(false)}>{t('components.confirm')}</Button>
                </>
              }
            >
              <p className="text-sm text-zinc-400">
                {t('components.dialogBody')}
              </p>
            </Dialog>
          </Section>

          {/* Tooltip */}
          <Section title={t('components.tooltip')}>
            <div className="flex gap-6">
              <Tooltip content={t('components.topTooltip')} side="top">
                <Button variant="secondary">{t('components.hoverTop')}</Button>
              </Tooltip>
              <Tooltip content={t('components.rightTooltip')} side="right">
                <Button variant="secondary">{t('components.hoverRight')}</Button>
              </Tooltip>
              <Tooltip content={t('components.bottomTooltip')} side="bottom">
                <Button variant="secondary">{t('components.hoverBottom')}</Button>
              </Tooltip>
            </div>
          </Section>

          {/* Icon / Spinner / EmptyState */}
          <Section title={t('components.iconSpinnerEmpty')}>
            <div className="flex items-start gap-8">
              <div className="flex items-center gap-2 text-zinc-400">
                <Icon size={20}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </Icon>
                <span className="text-sm">{t('components.infoIcon')}</span>
              </div>
              <Spinner size={24} />
              <EmptyState
                title={t('components.emptyTitle')}
                description={t('components.emptyDesc')}
                action={<Button size="sm" variant="secondary">{t('common.upload')}</Button>}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

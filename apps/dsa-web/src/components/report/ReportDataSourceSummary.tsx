import type React from 'react';
import {
  Database,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import type { ReportLanguage } from '../../types/analysis';
import { normalizeReportLanguage } from '../../utils/reportLanguage';
import { Badge, Card, StatusDot } from '../common';

interface ProviderRun {
  data_type: string;
  provider: string;
  success: boolean;
  record_count?: number;
  error_type?: string;
  error_message_sanitized?: string;
}

interface ReportDataSourceSummaryProps {
  contextSnapshot?: Record<string, unknown> | null;
  language?: ReportLanguage;
}

const DATA_SOURCE_LABELS: Record<string, string> = {
  realtime_quote: '实时行情',
  daily_data: '日线K线',
  chip: '筹码结构',
  belong_boards: '所属板块',
};

const DATA_SOURCE_ORDER = ['realtime_quote', 'daily_data', 'chip', 'belong_boards'];

const KNOWN_SEARCH_PROVIDERS = [
  'Bocha',
  'Tavily',
  'Anspire',
  'Brave',
  'SerpAPI',
  'MiniMax',
  'SearXNG',
];

const TEXT = {
  zh: {
    dataSourceTitle: '数据源',
    searchEngineTitle: '搜索引擎',
    configured: '已配置',
    notConfigured: '未配置',
    dataRecords: (n: number) => `数据${n}条`,
    fetchFailed: '获取失败',
    unknown: '状态未知',
    noSearchEngines: '未配置搜索引擎',
    searchConfigured: '搜索引擎已配置，数据已获取',
    providerLabel: '来源',
  },
  en: {
    dataSourceTitle: 'Data Sources',
    searchEngineTitle: 'Search Engines',
    configured: 'Configured',
    notConfigured: 'Not configured',
    dataRecords: (n: number) => `${n} records`,
    fetchFailed: 'Fetch failed',
    unknown: 'Unknown',
    noSearchEngines: 'No search engines configured',
    searchConfigured: 'Search engines configured, data fetched',
    providerLabel: 'Source',
  },
} as const;

const truncateError = (error: string, maxLen = 200): string => {
  if (error.length <= maxLen) return error;
  return error.slice(0, maxLen - 3) + '...';
};

/**
 * Extract and render data source & search engine status from
 * contextSnapshot.diagnostics.provider_runs.
 */
export const ReportDataSourceSummary: React.FC<ReportDataSourceSummaryProps> = ({
  contextSnapshot,
  language = 'zh',
}) => {
  const reportLanguage = normalizeReportLanguage(language);
  const t = TEXT[reportLanguage];

  if (!contextSnapshot) {
    return null;
  }

  // Extract provider_runs
  const diagnostics = (contextSnapshot.diagnostics || {}) as Record<string, unknown>;
  const providerRuns = (Array.isArray(diagnostics.provider_runs)
    ? diagnostics.provider_runs
    : []) as ProviderRun[];

  if (providerRuns.length === 0) {
    return null;
  }

  // Group runs
  const dataSourceRunsByType: Record<string, ProviderRun[]> = {};
  const searchRunsByProvider: Record<string, ProviderRun[]> = {};

  for (const run of providerRuns) {
    if (!run || typeof run !== 'object') continue;
    if (run.data_type === 'news_search') {
      const provider = run.provider || 'unknown';
      (searchRunsByProvider[provider] ||= []).push(run);
    } else if (DATA_SOURCE_LABELS[run.data_type]) {
      (dataSourceRunsByType[run.data_type] ||= []).push(run);
    }
  }

  // Build data source items
  const dataSourceItems: Array<{
    label: string;
    provider: string;
    configured: boolean;
    success: boolean;
    recordCount?: number;
    error?: string;
  }> = [];

  for (const dataType of DATA_SOURCE_ORDER) {
    const runs = dataSourceRunsByType[dataType];
    if (!runs || runs.length === 0) {
      dataSourceItems.push({
        label: DATA_SOURCE_LABELS[dataType],
        provider: '',
        configured: false,
        success: false,
      });
      continue;
    }

    const successes = runs.filter((r) => r.success === true);
    const failures = runs.filter((r) => r.success === false);

    if (successes.length > 0) {
      const best = successes[successes.length - 1];
      dataSourceItems.push({
        label: DATA_SOURCE_LABELS[dataType],
        provider: best.provider || '',
        configured: true,
        success: true,
        recordCount: best.record_count,
      });
    } else if (failures.length > 0) {
      const last = failures[failures.length - 1];
      const rawError = last.error_message_sanitized || last.error_type || '未知错误';
      dataSourceItems.push({
        label: DATA_SOURCE_LABELS[dataType],
        provider: last.provider || '',
        configured: true,
        success: false,
        error: truncateError(String(rawError)),
      });
    } else {
      dataSourceItems.push({
        label: DATA_SOURCE_LABELS[dataType],
        provider: runs[0]?.provider || '',
        configured: true,
        success: false,
        error: t.unknown,
      });
    }
  }

  // Build search engine items
  const searchItems: Array<{
    provider: string;
    configured: boolean;
    success: boolean;
    recordCount?: number;
    error?: string;
  }> = [];

  let hasAnySearchRun = false;
  for (const provider of KNOWN_SEARCH_PROVIDERS) {
    const runs = searchRunsByProvider[provider];
    if (!runs || runs.length === 0) continue;
    hasAnySearchRun = true;

    const successes = runs.filter((r) => r.success === true);
    const failures = runs.filter((r) => r.success === false);

    if (successes.length > 0) {
      const best = successes[successes.length - 1];
      searchItems.push({
        provider,
        configured: true,
        success: true,
        recordCount: best.record_count,
      });
    } else if (failures.length > 0) {
      const last = failures[failures.length - 1];
      const rawError = last.error_message_sanitized || last.error_type || '未知错误';
      searchItems.push({
        provider,
        configured: true,
        success: false,
        error: truncateError(String(rawError)),
      });
    }
  }

  // Don't render if nothing to show
  if (dataSourceItems.length === 0 && searchItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Data Sources */}
      {dataSourceItems.length > 0 && (
        <Card variant="bordered" padding="md" className="home-panel-card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Database className="h-4 w-4 text-cyan" />
            {t.dataSourceTitle}
          </h3>
          <div className="space-y-2">
            {dataSourceItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.configured ? (
                    item.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-danger" />
                    )
                  ) : (
                    <HelpCircle className="h-4 w-4 shrink-0 text-muted-text" />
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.label}
                  </span>
                  {item.provider && (
                    <span className="text-xs text-muted-text font-mono">
                      {item.provider}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.configured ? (
                    item.success ? (
                      <Badge variant="success" className="gap-1 shadow-none">
                        <StatusDot tone="success" className="h-1.5 w-1.5" />
                        {item.recordCount != null
                          ? t.dataRecords(item.recordCount)
                          : t.configured}
                      </Badge>
                    ) : (
                      <Badge variant="danger" className="gap-1 shadow-none" title={item.error}>
                        <StatusDot tone="danger" className="h-1.5 w-1.5" />
                        <span className="max-w-[200px] truncate">
                          {t.fetchFailed}
                          {item.error ? `(${item.error})` : ''}
                        </span>
                      </Badge>
                    )
                  ) : (
                    <Badge variant="default" className="gap-1 shadow-none">
                      <StatusDot tone="neutral" className="h-1.5 w-1.5" />
                      {t.notConfigured}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Search Engines */}
      <Card variant="bordered" padding="md" className="home-panel-card">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Search className="h-4 w-4 text-cyan" />
          {t.searchEngineTitle}
        </h3>
        {searchItems.length === 0 ? (
          <p className="text-xs text-muted-text py-2 px-3">
            {hasAnySearchRun ? t.searchConfigured : t.noSearchEngines}
          </p>
        ) : (
          <div className="space-y-2">
            {searchItems.map((item) => (
              <div
                key={item.provider}
                className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.success ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {item.provider}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.success ? (
                    <Badge variant="success" className="gap-1 shadow-none">
                      <StatusDot tone="success" className="h-1.5 w-1.5" />
                      {item.recordCount != null
                        ? t.dataRecords(item.recordCount)
                        : t.configured}
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="gap-1 shadow-none" title={item.error}>
                      <StatusDot tone="danger" className="h-1.5 w-1.5" />
                      <span className="max-w-[200px] truncate">
                        {t.fetchFailed}
                        {item.error ? `(${item.error})` : ''}
                      </span>
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

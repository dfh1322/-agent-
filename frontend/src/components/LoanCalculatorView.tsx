/**
 * LoanCalculatorView — 通用贷款计算器组件（CLAUDE.md 4.1）
 *
 * Props:
 *   * defaultPrice: 默认房屋总价（万元）
 *   * defaultDownPaymentRatio: 首付比例
 *   * defaultLoanTerm: 贷款年限
 *   * onAdvice? (calculation) => void —— 推荐 join lender calculator_advice
 *
 * 数据可视化使用 Ant Design 的 ``Descriptions`` + ``Table``，保持设计统一；
 * 实际计算由后端 ``/api/chat/calculator/advice`` 完成，前端不重复运算。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Form, InputNumber, Select, Slider, Button,
  Space, Typography, Descriptions, Table, Alert, Spin, App,
} from 'antd';
import { chatApi } from '../services/api';
import type { LoanCalculation } from '../types/loan';

const { Title, Text } = Typography;

export interface LoanCalculatorViewProps {
  defaultPrice?: number;
  defaultDownPaymentRatio?: number;
  defaultLoanTerm?: number;
  isSecondHome?: boolean;
  /** 计算结果回调（用于父组件把结果灌入看房计划 / 报告等） */
  onComputed?: (calc: LoanCalculation, advice: string) => void;
}

const LoanCalculatorView: React.FC<LoanCalculatorViewProps> = ({
  defaultPrice = 300,
  defaultDownPaymentRatio = 0.3,
  defaultLoanTerm = 30,
  isSecondHome = false,
  onComputed,
}) => {
  const [price, setPrice] = useState<number>(defaultPrice);
  const [downRatio, setDownRatio] = useState<number>(defaultDownPaymentRatio);
  const [loanTerm, setLoanTerm] = useState<number>(defaultLoanTerm);
  const [second, setSecond] = useState<boolean>(isSecondHome);
  const [hasPF, setHasPF] = useState<boolean>(false);
  const [calc, setCalc] = useState<LoanCalculation | null>(null);
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const ratioPercentLabel = useMemo(
    () => `${(downRatio * 100).toFixed(0)}%（${(price * downRatio).toFixed(1)} 万）`,
    [downRatio, price],
  );

  const { message } = App.useApp();

  const submit = async () => {
    if (!price || price <= 0) {
      message.warning('请输入有效的房屋总价');
      return;
    }
    setLoading(true);
    try {
      const resp = await chatApi.getCalculatorAdvice({
        price,
        down_payment_ratio: downRatio,
        loan_term: loanTerm,
        is_second_home: second,
        has_provident_fund: hasPF,
        interest_rate: second ? 0.044 : 0.038,
      });
      if (resp.success && resp.calculation) {
        setCalc(resp.calculation as unknown as LoanCalculation);
        setAdvice(resp.advice || '');
        onComputed?.(resp.calculation as unknown as LoanCalculation, resp.advice || '');
      } else {
        message.error(resp.error || '测算失败');
      }
    } catch (e: any) {
      message.error(e?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 默认值变更时，自动重算（便于父组件联动）
    if (defaultPrice) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPrice, defaultDownPaymentRatio, defaultLoanTerm, isSecondHome]);

  const rows = calc
    ? [
        { key: 'down_payment', label: '首付', value: `${calc.down_payment} 万` },
        { key: 'loan_amount', label: '贷款本金', value: `${calc.loan_amount} 万` },
        { key: 'monthly_payment', label: '月供', value: `${calc.monthly_payment} 万` },
        { key: 'total_payment', label: '总还款', value: `${calc.total_payment} 万` },
        { key: 'total_interest', label: '总利息', value: `${calc.total_interest} 万` },
      ]
    : [];

  return (
    <Card style={{ borderRadius: 12 }} variant="borderless" title={<Title level={4} style={{ margin: 0 }}>贷款计算器</Title>}>
      <Form layout="vertical">
        <Form.Item label="房屋总价（万元）" required>
          <InputNumber
            min={10}
            max={10000}
            step={10}
            value={price}
            onChange={(v) => setPrice(Number(v) || 0)}
            style={{ width: '100%' }}
            addonAfter="万"
          />
        </Form.Item>

        <Form.Item label="首付比例">
          <Slider
            min={0.2}
            max={0.7}
            step={0.05}
            value={downRatio}
            onChange={(v) => setDownRatio(Number(v))}
            tooltip={{ formatter: (v) => `${((Number(v) || 0) * 100).toFixed(0)}%` }}
          />
          <Text type="secondary">{ratioPercentLabel}</Text>
        </Form.Item>

        <Form.Item label="贷款年限（年）">
          <Select<number>
            value={loanTerm}
            onChange={setLoanTerm}
            options={[10, 15, 20, 25, 30].map((y) => ({ label: `${y} 年`, value: y }))}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="贷款类型与特色">
          <Space>
            <Select
              value={second ? 'second' : 'first'}
              onChange={(v) => setSecond(v === 'second')}
              options={[
                { label: '首套房', value: 'first' },
                { label: '二套房', value: 'second' },
              ]}
              style={{ width: 120 }}
            />
            <Select
              value={hasPF ? 'with_pf' : 'commercial'}
              onChange={(v) => setHasPF(v === 'with_pf')}
              options={[
                { label: '纯商贷', value: 'commercial' },
                { label: '含公积金', value: 'with_pf' },
              ]}
              style={{ width: 120 }}
            />
          </Space>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" loading={loading} onClick={submit}>立即测算</Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              利率与首付下限都通过 <code>system_configs.finance</code> 动态读取。
            </Text>
          </Space>
        </Form.Item>
      </Form>

      {calc ? (
        <Descriptions
          title="测算结果（来源：calculate_mortgage 工具）"
          column={2}
          bordered
          size="small"
          items={rows.map((r) => ({ key: r.key, label: r.label, children: r.value }))}
        />
      ) : loading ? <Spin /> : (
        <Alert type="info" title={'请输入总价后点击「立即测算」'} showIcon />
      )}

      {advice ? (
        <>
          <Title level={5} style={{ marginTop: 24 }}>专业建议</Title>
          <Table
            size="small"
            pagination={false}
            dataSource={[{ key: 'advice', content: advice }]}
            columns={[{ title: '内容', dataIndex: 'content', key: 'content' }]}
          />
        </>
      ) : null}
    </Card>
  );
};

export default LoanCalculatorView;

/**
 * DraggableModal — 可拖动的 Modal 包装组件（v2）
 *
 * 直接基于 antd v6 ``<Modal draggable>`` 实现，避免自实现定位 / transform
 * 与 antd 内置 modal layout（body / footer）发生错位。
 *
 * 设计要点：
 *   * 使用 antd 内置拖拽（v5.5+ 原生支持），不再依赖第三方事件监听；
 *   * 全屏居中 + 默认 top=80 避免与侧边栏重叠；
 *   * Esc / 点击遮罩关闭统一走 ``onCancel``；
 *   * ``destroyOnClose`` 默认关闭，避免残留 state。
 */
import React from 'react';
import { Modal } from 'antd';
import type { ModalProps } from 'antd';

export interface DraggableModalProps extends ModalProps {
  /** 兼容字段，关闭时可走 ``onCancel``。 */
  onCloseModal?: () => void;
  /** 初始偏移（保留兼容，内部忽略） */
  initialOffset?: { x: number; y: number };
}

const DraggableModal: React.FC<DraggableModalProps> = ({
  onCloseModal,
  children,
  onCancel,
  ...rest
}) => {
  const handleCancel: ModalProps['onCancel'] = (e) => {
    onCancel?.(e);
    onCloseModal?.();
  };

  return (
    <Modal
      {...rest}
      onCancel={handleCancel}
      mask={{ closable: true }}
      style={{ top: 80 }}
    >
      {children}
    </Modal>
  );
};

export default DraggableModal;
// ========== Toast 提示组件 ==========

/**
 * Toast 提示消息组件
 */
class Toast {
    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('info' | 'success' | 'error' | 'warning')
     * @param {number} duration - 显示时长(毫秒)
     */
    static show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        
        const bgColor = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        }[type] || '#3b82f6';

        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            background: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10002;
            opacity: 0;
            transition: all 0.3s ease;
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);

        // 延迟显示动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);

        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * 显示成功消息
     * @param {string} message
     * @param {number} duration
     */
    static success(message, duration = 3000) {
        Toast.show(message, 'success', duration);
    }

    /**
     * 显示错误消息
     * @param {string} message
     * @param {number} duration
     */
    static error(message, duration = 3000) {
        Toast.show(message, 'error', duration);
    }

    /**
     * 显示警告消息
     * @param {string} message
     * @param {number} duration
     */
    static warning(message, duration = 3000) {
        Toast.show(message, 'warning', duration);
    }

    /**
     * 显示信息消息
     * @param {string} message
     * @param {number} duration
     */
    static info(message, duration = 3000) {
        Toast.show(message, 'info', duration);
    }
}

export default Toast;

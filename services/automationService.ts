
export interface AutomationConfig {
    webhookUrl: string;
    targetPhone: string;
    botEnabled: boolean;
    shortfallCriticalThreshold: number;
    shortfallWarningThreshold: number;
}

export const saveAutomationConfig = (config: AutomationConfig) => {
    localStorage.setItem('swiss_automation_config', JSON.stringify(config));
};

export const getAutomationConfig = (): AutomationConfig => {
    const saved = localStorage.getItem('swiss_automation_config');
    if (saved) {
        const parsed = JSON.parse(saved);
        return {
            webhookUrl: '/webhook',
            targetPhone: '',
            botEnabled: false,
            shortfallCriticalThreshold: 100,
            shortfallWarningThreshold: 50,
            ...parsed
        };
    }
    return {
        webhookUrl: '/webhook',
        targetPhone: '',
        botEnabled: false,
        shortfallCriticalThreshold: 100,
        shortfallWarningThreshold: 50
    };
};

export const triggerAutomation = async (
    message: string,
    type: 'report' | 'alert' = 'report',
    fileData?: { base64: string, filename: string, mimetype: string }
) => {
    const config = getAutomationConfig();
    if (!config.botEnabled || !config.webhookUrl) {
        console.warn("Automation skipped: Bot not enabled or Webhook URL missing.");
        return false;
    }

    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                phone: config.targetPhone,
                type,
                file: fileData,
                timestamp: new Date().toISOString()
            })
        });

        if (!response.ok) throw new Error("Webhook failed");
        return true;
    } catch (error) {
        console.error("Automation Trigger Error:", error);
        return false;
    }
};

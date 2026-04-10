export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
}

let toasts = $state<Toast[]>([]);

export const toast = {
	get list() {
		return toasts;
	},

	show(message: string, type: Toast['type'] = 'info', duration = 3000) {
		const id = crypto.randomUUID();
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, duration);
	},

	success(message: string) {
		this.show(message, 'success');
	},

	error(message: string) {
		this.show(message, 'error', 5000);
	},

	info(message: string) {
		this.show(message, 'info');
	}
};

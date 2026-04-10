<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte.js';
</script>

{#if toast.list.length > 0}
	<div class="toast-container">
		{#each toast.list as t (t.id)}
			<div class="toast toast-{t.type}">
				{t.message}
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		bottom: 16px;
		right: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 9999;
		pointer-events: none;
	}

	.toast {
		padding: 10px 16px;
		border-radius: 6px;
		font-size: 13px;
		color: #e0e0e0;
		backdrop-filter: blur(8px);
		border: 1px solid;
		animation: slideIn 0.2s ease-out;
	}

	.toast-success {
		background: rgba(42, 74, 58, 0.95);
		border-color: #3a6a4a;
	}

	.toast-error {
		background: rgba(74, 42, 42, 0.95);
		border-color: #6a3a3a;
	}

	.toast-info {
		background: rgba(42, 42, 74, 0.95);
		border-color: #4a4a6a;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

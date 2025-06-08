<script setup lang="ts">
import type { IBusinessCardDetail } from "@/types/businessCard.ts";

const props = defineProps<{
	card: IBusinessCardDetail;
}>();
</script>

<template>
	<div
		class="rounded-lg bg-gray-900 overflow-hidden relative z-10 items-center lg:p-0 p-0 xl:drop-shadow-xl lg:w-[480px] lg:h-[600px] h-fit w-full"
	>
		<div class="flex lg:flex-col md:flex-row flex-col h-full">
			<div class="w-full businessCard-image__overlay">
				<NuxtImg
					:alt="props.card?.user?.name || 'Image'"
					:src="props.card?.user?.image || '/images/seo.jpg'"
					:width="480"
					:height="380"
					class="w-full lg:h-96 md:h-72 h-64 rounded-lg"
					placeholder
				/>
			</div>

			<div
				class="relative z-20 flex flex-col md:gap-4 gap-2 md:p-4 p-2 w-full h-full place-items-center"
			>
				<div class="grow text-center">
					<h1
						class="lg:text-3xl md:text-2xl text-xl font-bold md:mb-0.5"
					>
						{{ props.card?.user?.name }}
					</h1>
					<h6 class="text-slate-400 text-base">
						{{ props.card?.subtitle }}
					</h6>
				</div>
				<div class="grid grid-cols-2 place-items-center w-full">
					<ULink disabled>
						<UIcon
							name="material-symbols:download"
							class="text-3xl"
						/>
					</ULink>
					<ULink :to="`mailto:${props.card?.user?.email}`">
						<UIcon name="ic:round-email" class="text-3xl" />
					</ULink>
				</div>
			</div>
		</div>
	</div>
</template>

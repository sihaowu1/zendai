import { z } from 'zod';
import { Composition } from 'remotion';
import { GeneratedScene } from './GeneratedScene';

const scenePropsSchema = z.object({
  fps: z.number(),
  durationInSeconds: z.number(),
  width: z.number(),
  height: z.number(),
});

const defaultProps: z.infer<typeof scenePropsSchema> = {
  fps: 30,
  durationInSeconds: 6,
  width: 1280,
  height: 720,
};

/**
 * Registers the single composition the MotionForge renderer targets
 * (server/src/remotion/renderer.ts calls selectComposition/renderMedia with
 * id "GeneratedScene" and these same inputProps). calculateMetadata resolves
 * duration/fps/size from the props sent by the MP4 export job, so one
 * composition serves every render request.
 */
export function RemotionRoot() {
  return (
    <Composition<typeof scenePropsSchema, z.infer<typeof scenePropsSchema>>
      id="GeneratedScene"
      component={GeneratedScene}
      schema={scenePropsSchema}
      durationInFrames={Math.round(defaultProps.durationInSeconds * defaultProps.fps)}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.round(props.durationInSeconds * props.fps),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  );
}

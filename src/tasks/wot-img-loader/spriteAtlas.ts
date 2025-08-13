
const RESOLUTIONS = [128, 256, 512, 1024];


function pack(resolution: number, width: number, height: number) {
  if (resolution < width || resolution < height) throw new Error(`Resolution ${resolution} is too small for image ${width}x${height}`);

  const rows = Math.floor(resolution / height);
  const cols = Math.floor(resolution / width);

  return {
    rows,
    cols,
    total: rows * cols,
    rowHeight: height,
    colWidth: width
  };
}

function bestResolution(width: number, height: number, count: number, resolutions?: number[]) {
  const possibleResolutions = resolutions ?? RESOLUTIONS;

  for (const resolution of possibleResolutions) {

    try {
      const packed = pack(resolution, width, height);
      if (packed.total >= count) {
        return { resolution, ...packed, count: Math.min(count, packed.total) };
      }
    } catch (error) { }
  }

  const maxResolution = possibleResolutions[possibleResolutions.length - 1];
  const packed = pack(maxResolution, width, height);
  return { resolution: maxResolution, ...packed, count: Math.min(count, packed.total) };
}

type SpriteAtlas = {
  info: {
    index: number;
    resolution: {
      width: number;
      height: number;
    },
    defaultItemSize: {
      width: number;
      height: number;
    },
    gap: number;
  }
  data: {
    image: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }[]
}

export async function createSpriteAtlas(params: {
  images: string[],
  width: number,
  height: number,
  gap: number,
  resolutions?: number[]
}) {

  const { images, width, height, gap, resolutions } = params;

  let enough = params.images.length

  const atlases: SpriteAtlas[] = []

  console.log(`Packing ${enough} images with size ${width}x${height}`);


  while (enough >= 0) {
    const best = bestResolution(width + gap * 2, height + gap * 2, enough, resolutions);
    console.log(`Packing ${best.count} images into ${best.resolution}x${best.resolution} atlas`);

    const atlas: SpriteAtlas = {
      info: {
        index: atlases.length,
        resolution: {
          width: best.resolution,
          height: best.resolution
        },
        defaultItemSize: {
          width: params.width,
          height: params.height
        },
        gap: gap
      },
      data: []
    };

    let x = 0;
    let y = 0;

    for (let i = 0; i < best.total && i < images.length; i++) {
      const image = images[i];

      const imageWidth = params.width + gap * 2;
      const imageHeight = params.height + gap * 2;

      if (x + imageWidth > best.resolution) {
        x = 0;
        y += imageHeight;
      }

      if (y + imageHeight > best.resolution) {
        console.warn(`Image ${image} is too big for atlas ${best.resolution}x${best.resolution}`);
        continue;
      }

      atlas.data.push({
        image,
        x: x + gap,
        y: y + gap,
      });

      x += imageWidth;
    }

    atlases.push(atlas);


    enough -= best.total;
    images.splice(0, best.total);
  }

  return atlases;
}
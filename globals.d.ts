declare module "*.css" {
    const content: Record<string, string>;
    export default content;
}

type Mutate<T> = Partial<T> | ((prev: T) => Partial<T>);

import * as wagmi from "wagmi"
import { useProvider, useSigner } from "wagmi"
import type { BigNumber } from "ethers"
import CommentsContract from "../artifacts/contracts/Comments.sol/Comments.json";

export interface Comment {
    id: string;
    topic: string;
    message: string;
    creator_address: string;
    created_at: BigNumber;
}

export enum EventType {
    CommentAdded = "CommentAdded"
}

const useCommentsContract = () => {
    const [signer] = useSigner()
    const provider = useProvider()
    const contract = wagmi.useContract({
        addressOrName: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
        contractInterface: CommentsContract.abi,
        signerOrProvider: signer.data || provider
    })

    const getComments = async (topic: string): Promise<Comment[]> => {
        const comments = await contract.getComments(topic);
        // Comment is represented as an array to converting to the object
        return comments.map(c => ({ ...c }))
    }

    const addComment = async (topic: string, message: string): Promise<void> => {
        const tx = await contract.addComment(topic, message);
        await tx.wait()
    }

    return {
        contract,
        chainId: contract.provider.network?.chainId,
        getComments,
        addComment
    }
}

export default useCommentsContract;